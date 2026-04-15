import { ThreadChannel } from "discord.js";
import { updateIssue, addIssueComment } from "../github.js";
import { getThreadState, deleteThreadState } from "../state.js";
import { hasResolvedTag } from "../utils.js";

export async function handleForumPostDelete(thread: ThreadChannel): Promise<void> {
    const state = getThreadState(thread.id);
    if (!state) return;
    const isCompleted = hasResolvedTag(thread);
    const stateReason = isCompleted ? "completed" : "not_planned";

    try {
        // Leave a comment explaining why it's being closed, then close it
        // Original issue body stays intact
        await addIssueComment(
            state.repo,
            state.issueNumber,
            isCompleted
                ? "> ✅ This issue has been closed automatically as completed — the Discord forum post was deleted after being marked Completed."
                : "> 🔒 This issue has been closed automatically — the original Discord forum post was deleted by the user."
        );

        await updateIssue(state.repo, state.issueNumber, {
            state: "closed",
            state_reason: stateReason,
        });

        console.log(`[ForumIssues] Closed issue #${state.issueNumber} in ${state.repo} (thread deleted: ${thread.id})`);
    } catch (err) {
        console.error(`[ForumIssues] Failed to close issue for deleted thread ${thread.id}:`, err);
    } finally {
        deleteThreadState(thread.id);
    }
}
