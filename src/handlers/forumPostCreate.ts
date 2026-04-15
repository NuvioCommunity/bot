import { EmbedBuilder, ThreadChannel } from "discord.js";
import { createIssue } from "../github.js";
import { setThreadState } from "../state.js";
import { resolveRepoForThread, buildIssueBody, getAppliedTagNames } from "../utils.js";

export async function handleForumPostCreate(thread: ThreadChannel): Promise<void> {
    try {
        const starterMsg = await thread.fetchStarterMessage().catch(() => null);
        if (!starterMsg) {
            console.warn(`[ForumIssues] No starter message for thread ${thread.id}`);
            return;
        }

        const repo = resolveRepoForThread(thread);
        const tagNames = getAppliedTagNames(thread);
        const threadUrl = `https://discord.com/channels/${thread.guildId}/${thread.id}`;

        const issueBody = buildIssueBody(
            starterMsg.content,
            starterMsg.author.tag,
            tagNames,
            threadUrl
        );

        const issue = await createIssue(repo, thread.name, issueBody, tagNames);

        // Persist thread → issue mapping
        setThreadState(thread.id, {
            repo,
            issueNumber: issue.number,
            issueUrl: issue.html_url,
            source: "discord",
            lastGithubCommentId: 0,
            selfReplyCount: 0,
            commentSyncLocked: false,
            commentMap: {},
            githubCommentMirrorMap: {},
        });

        const createdEmbed = new EmbedBuilder()
            .setColor(0x1f6feb)
            .setTitle("GitHub Issue Created")
            .setURL(issue.html_url)
            .setDescription(`[Open issue #${issue.number}](${issue.html_url})`)
            .addFields(
                { name: "Repository", value: repo, inline: true },
                { name: "Thread", value: `[Open thread](${threadUrl})`, inline: true },
                { name: "Tags", value: tagNames.length > 0 ? tagNames.join(", ") : "None", inline: true }
            )
            .setFooter({ text: "Forum -> GitHub sync" })
            .setTimestamp(new Date());

        await thread.send({ embeds: [createdEmbed] });

        console.log(`[ForumIssues] Created issue #${issue.number} in ${repo} for thread ${thread.id}`);
    } catch (err) {
        console.error(`[ForumIssues] Failed to create issue for thread ${thread.id}:`, err);
    }
}
