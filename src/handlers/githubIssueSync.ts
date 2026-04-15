import { Client, EmbedBuilder, ForumChannel, ThreadAutoArchiveDuration, ThreadChannel } from "discord.js";
import { FORUM_BUGS_ID, FORUM_SUGGESTIONS_ID, config } from "../config.js";
import { getIssue, listRepoIssues } from "../github.js";
import {
    deleteThreadState,
    findThreadIdByIssue,
    getIssueCursor,
    listThreadStates,
    setIssueCursor,
    setThreadState,
} from "../state.js";
import { normalizeGithubMarkdownForDiscord } from "../utils.js";

const EMBED_DESCRIPTION_LIMIT = 4096;
const RESOLVED_TAGS = new Set(["close", "closed", "completed"]);

function trimForEmbed(input: string): string {
    if (input.length <= EMBED_DESCRIPTION_LIMIT) return input;
    return `${input.slice(0, EMBED_DESCRIPTION_LIMIT - 3)}...`;
}

function hasAnyLabel(labels: string[], candidates: string[]): boolean {
    const labelSet = new Set(labels.map((label) => label.toLowerCase()));
    return candidates.some((candidate) => labelSet.has(candidate.toLowerCase()));
}

function selectForumId(labels: string[]): string {
    if (hasAnyLabel(labels, ["bug"])) return FORUM_BUGS_ID;
    if (hasAnyLabel(labels, ["enhancement", "enchantment", "help wanted"])) return FORUM_SUGGESTIONS_ID;
    return FORUM_BUGS_ID;
}

function selectForumTagNames(labels: string[], state: "open" | "closed"): string[] {
    const names: string[] = [];
    if (hasAnyLabel(labels, ["android tv"])) names.push("Android TV");
    if (hasAnyLabel(labels, ["tizenos"])) names.push("TizenOS");
    if (hasAnyLabel(labels, ["webos"])) names.push("WebOS");

    if (state === "open") names.push("Open");
    if (state === "closed") names.push("Close");
    return names;
}

function getTagIdsByName(forum: ForumChannel, tagNames: string[]): string[] {
    const wanted = new Set(tagNames.map((name) => name.toLowerCase()));
    return forum.availableTags
        .filter((tag) => wanted.has(tag.name.toLowerCase()))
        .map((tag) => tag.id);
}

function buildIssueEmbed(repo: string, issueNumber: number, issueUrl: string, title: string, body: string, author: string): EmbedBuilder {
    const normalizedBody = trimForEmbed(normalizeGithubMarkdownForDiscord(body));

    return new EmbedBuilder()
        .setColor(0x0e7490)
        .setTitle(`GitHub Issue #${issueNumber}`)
        .setURL(issueUrl)
        .setDescription(normalizedBody)
        .addFields(
            { name: "Repository", value: repo, inline: true },
            { name: "Issue", value: `[Open issue](${issueUrl})`, inline: true },
            { name: "Title", value: title, inline: false }
        )
        .setFooter({ text: `Opened by ${author}` })
        .setTimestamp(new Date());
}

async function ensureIssueThreads(client: Client): Promise<void> {
    for (const repo of config.WATCHED_REPOS) {
        const openIssues = await listRepoIssues(repo, "open");
        const maxId = openIssues.reduce((max, issue) => Math.max(max, issue.id), 0);
        const cursor = getIssueCursor(repo);

        // First run seeds cursor to avoid backfilling old issues.
        if (cursor === undefined) {
            setIssueCursor(repo, maxId);
            continue;
        }

        const newIssues = openIssues
            .filter((issue) => issue.id > cursor)
            .sort((a, b) => a.id - b.id);

        let nextCursor = cursor;

        for (const issue of newIssues) {
            nextCursor = Math.max(nextCursor, issue.id);

            const alreadyMapped = findThreadIdByIssue(repo, issue.number);
            if (alreadyMapped) continue;

            const forumId = selectForumId(issue.labels);
            const channel = await client.channels.fetch(forumId).catch(() => null);
            if (!channel || !(channel instanceof ForumChannel)) continue;

            const tagNames = selectForumTagNames(issue.labels, issue.state);
            const appliedTags = getTagIdsByName(channel, tagNames);
            const starterContent = [
                `Synced from GitHub issue: ${issue.html_url}`,
                issue.labels.length > 0 ? `Labels: ${issue.labels.join(", ")}` : "Labels: none",
                "",
                normalizeGithubMarkdownForDiscord(issue.body),
            ].join("\n");

            const created = await channel.threads.create({
                name: issue.title.slice(0, 100),
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                appliedTags,
                message: {
                    content: starterContent,
                },
            });

            const issueEmbed = buildIssueEmbed(repo, issue.number, issue.html_url, issue.title, issue.body, issue.user);
            await created.send({ embeds: [issueEmbed] });

            setThreadState(created.id, {
                repo,
                issueNumber: issue.number,
                issueUrl: issue.html_url,
                source: "github",
                lastGithubCommentId: 0,
                selfReplyCount: 0,
                commentSyncLocked: false,
                commentMap: {},
                githubCommentMirrorMap: {},
            });

            console.log(`[ForumIssues] Mirrored GitHub issue #${issue.number} (${repo}) to forum thread ${created.id}`);
        }

        if (nextCursor !== cursor) {
            setIssueCursor(repo, nextCursor);
        }
    }
}

async function closeForumThreadsForClosedIssues(client: Client): Promise<void> {
    const tracked = listThreadStates();

    for (const { threadId, state } of tracked) {
        try {
            const issue = await getIssue(state.repo, state.issueNumber);
            if (issue.state !== "closed") continue;

            const channel = await client.channels.fetch(threadId).catch(() => null);
            if (!channel || !channel.isThread()) {
                deleteThreadState(threadId);
                continue;
            }

            const thread = channel as ThreadChannel;
            const parent = thread.parent;
            if (!(parent instanceof ForumChannel)) {
                deleteThreadState(threadId);
                continue;
            }

            const resolvedTag = parent.availableTags.find((tag) => RESOLVED_TAGS.has(tag.name.toLowerCase()));
            const currentTags = new Set(thread.appliedTags ?? []);
            if (resolvedTag) currentTags.add(resolvedTag.id);

            deleteThreadState(threadId);

            if (!thread.archived) {
                await thread.setArchived(true, "Closed on GitHub");
            }
            if (!thread.locked) {
                await thread.setLocked(true, "Closed on GitHub");
            }
            if (resolvedTag) {
                await thread.setAppliedTags([...currentTags]);
            }

            console.log(`[ForumIssues] Closed forum thread ${threadId} because GitHub issue #${state.issueNumber} is closed`);
        } catch (err) {
            console.error(`[ForumIssues] Failed GitHub-close sync for thread ${threadId}:`, err);
        }
    }
}

export async function syncGithubIssuesToDiscord(client: Client): Promise<void> {
    await ensureIssueThreads(client);
    await closeForumThreadsForClosedIssues(client);
}

export function startGithubIssueSync(client: Client): void {
    let inFlight = false;

    const tick = async (): Promise<void> => {
        if (inFlight) return;
        inFlight = true;
        try {
            await syncGithubIssuesToDiscord(client);
        } finally {
            inFlight = false;
        }
    };

    void tick();
    setInterval(() => {
        void tick();
    }, config.GITHUB_ISSUE_POLL_MS);
}
