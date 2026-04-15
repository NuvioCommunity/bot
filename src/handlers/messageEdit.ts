import { Message, ThreadChannel } from "discord.js";
import { updateIssueComment } from "../github.js";
import { getThreadState } from "../state.js";
import { buildCommentBody } from "../utils.js";

export async function handleMessageEdit(thread: ThreadChannel, message: Message): Promise<void> {
    if (message.author.bot) return;

    const state = getThreadState(thread.id);
    if (!state) return;

    const mappedCommentId = state.commentMap[message.id];
    if (!mappedCommentId) return;

    try {
        const body = buildCommentBody(message.content, message.author.tag);
        await updateIssueComment(state.repo, mappedCommentId, body);
        console.log(`[ForumIssues] Updated GitHub comment ${mappedCommentId} from edited Discord message ${message.id}`);
    } catch (err) {
        console.error(`[ForumIssues] Failed to update GitHub comment for edited Discord message ${message.id}:`, err);
    }
}
