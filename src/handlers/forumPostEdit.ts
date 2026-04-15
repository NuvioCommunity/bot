import { Message, ThreadChannel } from "discord.js";
import { updateIssue } from "../github.js";
import { getThreadState } from "../state.js";
import { buildIssueBody, getAppliedTagNames } from "../utils.js";

export async function handleForumPostEdit(thread: ThreadChannel, newMessage: Message): Promise<void> {
    const state = getThreadState(thread.id);
    if (!state) return; // Thread predates the bot — nothing to update

    try {
        const tagNames = getAppliedTagNames(thread);
        const threadUrl = `https://discord.com/channels/${thread.guildId}/${thread.id}`;

        const newBody = buildIssueBody(
            newMessage.content,
            newMessage.author.tag,
            tagNames,
            threadUrl
        );

        await updateIssue(state.repo, state.issueNumber, {
            title: thread.name,
            body: newBody,
        });

        console.log(`[ForumIssues] Updated issue #${state.issueNumber} in ${state.repo} (edit sync for thread ${thread.id})`);
    } catch (err) {
        console.error(`[ForumIssues] Failed to update issue for thread ${thread.id}:`, err);
    }
}
