import { Client, EmbedBuilder, ThreadChannel } from "discord.js";
import { config } from "../config.js";
import { listIssueComments } from "../github.js";
import { listThreadStates, updateThreadState } from "../state.js";
import { normalizeGithubMarkdownForDiscord } from "../utils.js";

const EMBED_DESCRIPTION_LIMIT = 4096;
const DISCORD_REPLY_PREFIX = "> **Discord reply by:**";

function trimForEmbed(input: string): string {
    if (input.length <= EMBED_DESCRIPTION_LIMIT) return input;
    return `${input.slice(0, EMBED_DESCRIPTION_LIMIT - 3)}...`;
}

function buildGithubReplyEmbed(
    repo: string,
    issueUrl: string,
    body: string,
    author: string,
    commentUrl: string,
    editedAt?: string,
    authorProfileUrl?: string,
    authorAvatarUrl?: string
): EmbedBuilder {
    const content = trimForEmbed(normalizeGithubMarkdownForDiscord(body));
    const editedText = editedAt ? ` | edited on ${new Date(editedAt).toUTCString()}` : "";
    const embed = new EmbedBuilder()
        .setColor(0x2ea043)
        .setTitle("New GitHub Reply")
        .setURL(commentUrl)
        .setDescription(content)
        .addFields(
            { name: "Repository", value: repo, inline: true },
            { name: "Issue", value: `[Open issue](${issueUrl})`, inline: true },
            { name: "Comment", value: `[Open comment](${commentUrl})`, inline: true }
        )
        .setFooter({ text: `Mirrored from GitHub${editedText}` })
        .setTimestamp(new Date());

    if (authorProfileUrl) {
        embed.setAuthor({
            name: author,
            url: authorProfileUrl,
            iconURL: authorAvatarUrl,
        });
    } else {
        embed.setAuthor({ name: author, iconURL: authorAvatarUrl });
    }

    return embed;
}

export async function syncGithubRepliesToDiscord(client: Client): Promise<void> {
    const tracked = listThreadStates();

    for (const { threadId, state } of tracked) {
        try {
            const channel = await client.channels.fetch(threadId).catch(() => null);
            if (!channel || !channel.isThread()) continue;

            const thread = channel as ThreadChannel;
            if (thread.archived || thread.locked) continue;

            const comments = await listIssueComments(state.repo, state.issueNumber);
            const lastSeen = state.lastGithubCommentId ?? 0;
            let highestSeen = lastSeen;
            const mirrorMap = { ...(state.githubCommentMirrorMap ?? {}) };
            let mirrorMapChanged = false;

            for (const comment of comments) {
                if (comment.id <= lastSeen) continue;

                // Avoid echoing comments that originated in Discord.
                if (comment.body.startsWith(DISCORD_REPLY_PREFIX)) {
                    if (comment.id > highestSeen) highestSeen = comment.id;
                    continue;
                }

                const embed = buildGithubReplyEmbed(
                    state.repo,
                    state.issueUrl,
                    comment.body,
                    comment.user,
                    comment.html_url,
                    comment.updatedAt !== comment.createdAt ? comment.updatedAt : undefined,
                    comment.userProfileUrl,
                    comment.userAvatarUrl
                );
                const mirrored = await thread.send({ embeds: [embed] });
                mirrorMap[String(comment.id)] = {
                    discordMessageId: mirrored.id,
                    updatedAt: comment.updatedAt,
                };
                mirrorMapChanged = true;
                if (comment.id > highestSeen) highestSeen = comment.id;
                continue;
            }

            for (const comment of comments) {
                if (comment.id > lastSeen) continue;
                if (comment.body.startsWith(DISCORD_REPLY_PREFIX)) continue;

                const mapKey = String(comment.id);
                const mirrored = mirrorMap[mapKey];
                if (!mirrored) continue;
                if (mirrored.updatedAt === comment.updatedAt) continue;

                const message = await thread.messages.fetch(mirrored.discordMessageId).catch(() => null);
                if (!message) continue;

                const editedEmbed = buildGithubReplyEmbed(
                    state.repo,
                    state.issueUrl,
                    comment.body,
                    comment.user,
                    comment.html_url,
                    comment.updatedAt !== comment.createdAt ? comment.updatedAt : undefined,
                    comment.userProfileUrl,
                    comment.userAvatarUrl
                );
                await message.edit({ embeds: [editedEmbed] });
                mirrorMap[mapKey] = {
                    discordMessageId: mirrored.discordMessageId,
                    updatedAt: comment.updatedAt,
                };
                mirrorMapChanged = true;
            }

            if (highestSeen !== lastSeen || mirrorMapChanged) {
                updateThreadState(threadId, {
                    lastGithubCommentId: highestSeen,
                    githubCommentMirrorMap: mirrorMap,
                });
            }
        } catch (err) {
            console.error(`[ForumIssues] Failed GitHub reply sync for thread ${threadId}:`, err);
        }
    }
}

export function startGithubReplySync(client: Client): void {
    let inFlight = false;

    const tick = async (): Promise<void> => {
        if (inFlight) return;
        inFlight = true;
        try {
            await syncGithubRepliesToDiscord(client);
        } finally {
            inFlight = false;
        }
    };

    void tick();
    setInterval(() => {
        void tick();
    }, config.GITHUB_REPLY_POLL_MS);
}
