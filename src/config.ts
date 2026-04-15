import "dotenv/config";

function readOptionalPositiveInt(key: string): number | undefined {
    const raw = process.env[key];
    if (!raw) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return Math.floor(parsed);
}

export const SERVER_ID = "1379902184207941732";

export const FORUM_SUGGESTIONS_ID = "1458552157836935359";
export const FORUM_BUGS_ID = "1458552195904573513";

export const FORUM_CHANNEL_IDS = [
    FORUM_SUGGESTIONS_ID,
    FORUM_BUGS_ID,
] as const;

// Tag name -> GitHub repo (owner/repo)
export const TAG_REPO_MAP: Record<string, string> = {
    "Android TV": "NuvioMedia/NuvioTV",
    "WebOS": "NuvioMedia/NuvioWeb",
    "TizenOS": "NuvioMedia/NuvioWeb",
};

const WATCHED_REPOS = ["NuvioMedia/NuvioTV", "NuvioMedia/NuvioWeb"] as const;

export const config = {
    DISCORD_TOKEN:       requireEnv("DISCORD_TOKEN"),
    GITHUB_TOKEN:        requireEnv("GITHUB_TOKEN"),
    SERVER_ID,
    DEFAULT_GITHUB_REPO: "NuvioMedia/NuvioTV",
    FORUM_CHANNEL_IDS,
    TAG_REPO_MAP,
    WATCHED_REPOS,
    // Optional cap for consecutive OP self-replies before sync stops.
    // If omitted, OP replies are unlimited.
    MAX_SELF_REPLIES:    readOptionalPositiveInt("MAX_SELF_REPLIES"),
    // How often to poll GitHub for new issue comments to mirror into Discord
    GITHUB_REPLY_POLL_MS: Number(process.env.GITHUB_REPLY_POLL_MS ?? "30000"),
    // How often to poll GitHub for new/closed issues to mirror thread lifecycle
    GITHUB_ISSUE_POLL_MS: Number(process.env.GITHUB_ISSUE_POLL_MS ?? "20000"),
};

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
}
