import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, "../data/state.json");

interface ThreadState {
    repo: string;
    issueNumber: number;
    issueUrl: string;
    source?: "discord" | "github";
    // Highest GitHub comment ID already mirrored to Discord
    lastGithubCommentId?: number;
    // How many times OP has self-replied (resets if another user joins)
    selfReplyCount: number;
    // true once we stop syncing comments (either another user joined or limit hit)
    commentSyncLocked: boolean;
    lockReason?: "other_user" | "limit_reached";
    // Discord message ID → GitHub comment ID
    commentMap: Record<string, number>;
    // GitHub comment ID -> mirrored Discord message + last seen update timestamp
    githubCommentMirrorMap?: Record<string, { discordMessageId: string; updatedAt: string }>;
}

interface State {
    threads: Record<string, ThreadState>;
    issueCursors: Record<string, number>;
}

function ensureDir(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadState(): State {
    if (!existsSync(STATE_PATH)) return { threads: {}, issueCursors: {} };
    try {
        const parsed = JSON.parse(readFileSync(STATE_PATH, "utf-8")) as Partial<State>;
        return {
            threads: parsed.threads ?? {},
            issueCursors: parsed.issueCursors ?? {},
        };
    } catch {
        return { threads: {}, issueCursors: {} };
    }
}

function saveState(state: State): void {
    ensureDir(STATE_PATH);
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

let _state = loadState();

export function getThreadState(threadId: string): ThreadState | undefined {
    return _state.threads[threadId];
}

export function listThreadStates(): Array<{ threadId: string; state: ThreadState }> {
    return Object.entries(_state.threads).map(([threadId, state]) => ({ threadId, state }));
}

export function findThreadIdByIssue(repo: string, issueNumber: number): string | undefined {
    for (const [threadId, state] of Object.entries(_state.threads)) {
        if (state.repo === repo && state.issueNumber === issueNumber) return threadId;
    }
    return undefined;
}

export function setThreadState(threadId: string, state: ThreadState): void {
    _state.threads[threadId] = state;
    saveState(_state);
}

export function updateThreadState(threadId: string, patch: Partial<ThreadState>): void {
    const existing = _state.threads[threadId];
    if (!existing) return;
    _state.threads[threadId] = { ...existing, ...patch };
    saveState(_state);
}

export function deleteThreadState(threadId: string): void {
    delete _state.threads[threadId];
    saveState(_state);
}

export function getIssueCursor(repo: string): number | undefined {
    return _state.issueCursors[repo];
}

export function setIssueCursor(repo: string, issueId: number): void {
    _state.issueCursors[repo] = issueId;
    saveState(_state);
}
