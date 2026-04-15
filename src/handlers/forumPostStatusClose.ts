import { ThreadChannel } from "discord.js";
import { addIssueComment, updateIssue } from "../github.js";
import { deleteThreadState, getThreadState } from "../state.js";
import { hasResolvedTag } from "../utils.js";

interface CloseTriggers {
    becameLocked: boolean;
    becameArchived: boolean;
    completedTagAdded: boolean;
}

function buildCloseComment(triggers: CloseTriggers, isCompleted: boolean): string {
    if (triggers.completedTagAdded) {
        return "> ✅ This issue has been closed automatically because the Discord forum post was tagged Completed.";
    }

    if (isCompleted) {
        return "> ✅ This issue has been closed automatically as completed because the Discord forum post was closed/locked and marked Completed.";
    }

    if (triggers.becameLocked && triggers.becameArchived) {
        return "> 🔒 This issue has been closed automatically because the Discord forum post was locked and closed.";
    }

    if (triggers.becameLocked) {
        return "> 🔒 This issue has been closed automatically because the Discord forum post was locked.";
    }

    return "> 🔒 This issue has been closed automatically because the Discord forum post was closed.";
}

export async function handleForumPostStatusClose(thread: ThreadChannel, triggers: CloseTriggers): Promise<void> {
    const state = getThreadState(thread.id);
    if (!state) return;

    const isCompleted = hasResolvedTag(thread);
    const stateReason = isCompleted ? "completed" : "not_planned";

    try {
        await addIssueComment(
            state.repo,
            state.issueNumber,
            buildCloseComment(triggers, isCompleted)
        );

        await updateIssue(state.repo, state.issueNumber, {
            state: "closed",
            state_reason: stateReason,
        });

        console.log(
            `[ForumIssues] Closed issue #${state.issueNumber} in ${state.repo} (status update for thread ${thread.id})`
        );
    } catch (err) {
        console.error(`[ForumIssues] Failed to close issue for status-updated thread ${thread.id}:`, err);
    } finally {
        deleteThreadState(thread.id);
    }
}
