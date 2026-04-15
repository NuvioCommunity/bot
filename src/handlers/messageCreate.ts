import { Message, ThreadChannel } from "discord.js";
import { addIssueComment } from "../github.js";
import { getThreadState, updateThreadState } from "../state.js";
import { buildCommentBody } from "../utils.js";
import { config } from "../config.js";

export async function handleMessageCreate(thread: ThreadChannel, message: Message): Promise<void> {
    // Ignore bot messages (our own link posts, etc.)
    if (message.author.bot) return;

    const state = getThreadState(thread.id);
    if (!state) return; // Thread not tracked

    // Comment sync already stopped — nothing to do
    if (state.commentSyncLocked) return;

    // Fetch OP's user ID from the starter message
    const starterMsg = await thread.fetchStarterMessage().catch(() => null);
    if (!starterMsg) return;

    const acceptsAnyUserReplies = state.source === "github";
    const opId = starterMsg.author.id;
    const isOP = acceptsAnyUserReplies || message.author.id === opId;

    // ── Another user joins → lock and stop ───────────────────────────────────
    if (!isOP) {
        updateThreadState(thread.id, {
            commentSyncLocked: true,
            lockReason: "other_user",
        });
        console.log(`[ForumIssues] Thread ${thread.id}: comment sync locked — another user joined`);
        return;
    }

    // ── OP self-reply ─────────────────────────────────────────────────────────
    const nextCount = state.selfReplyCount + 1;
    const maxReplies = config.MAX_SELF_REPLIES;
    const hasLimit = typeof maxReplies === "number" && Number.isFinite(maxReplies) && maxReplies > 0;

    if (hasLimit && nextCount > maxReplies) {
        // Somehow got here past the limit — lock defensively
        updateThreadState(thread.id, {
            commentSyncLocked: true,
            lockReason: "limit_reached",
        });
        return;
    }

    // Sync this reply to GitHub as a comment
    try {
        const body = buildCommentBody(message.content, message.author.tag);
        const comment = await addIssueComment(state.repo, state.issueNumber, body);
        const updatedCommentMap = { ...state.commentMap, [message.id]: comment.id };

        if (hasLimit && nextCount >= maxReplies) {
            // This was the final allowed reply under the configured cap.
            updateThreadState(thread.id, {
                selfReplyCount: nextCount,
                commentSyncLocked: true,
                lockReason: "limit_reached",
                commentMap: updatedCommentMap,
            });
            console.log(`[ForumIssues] Thread ${thread.id}: synced self-reply #${nextCount}, now locked (limit reached)`);
        } else {
            updateThreadState(thread.id, {
                selfReplyCount: nextCount,
                commentMap: updatedCommentMap,
            });
            if (hasLimit) {
                console.log(`[ForumIssues] Thread ${thread.id}: synced self-reply #${nextCount}/${maxReplies}`);
            } else {
                console.log(`[ForumIssues] Thread ${thread.id}: synced self-reply #${nextCount} (unlimited mode)`);
            }
        }
    } catch (err) {
        console.error(`[ForumIssues] Failed to sync comment for thread ${thread.id}:`, err);
    }
}
