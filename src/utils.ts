import { ThreadChannel } from "discord.js";
import { config } from "./config.js";

/**
 * Inspect the applied tags on a forum thread and return the appropriate GitHub repo string.
 * Falls back to DEFAULT_GITHUB_REPO if no tag matches.
 */
export function resolveRepoForThread(thread: ThreadChannel): string {
    const appliedTagIds = thread.appliedTags ?? [];
    const parent = thread.parent;

    if (parent && "availableTags" in parent) {
        for (const tagId of appliedTagIds) {
            const tag = parent.availableTags.find(t => t.id === tagId);
            if (tag?.name && config.TAG_REPO_MAP[tag.name]) {
                return config.TAG_REPO_MAP[tag.name];
            }
        }
    }

    return config.DEFAULT_GITHUB_REPO;
}

/** Get display names of tags applied to a thread */
export function getAppliedTagNames(thread: ThreadChannel): string[] {
    const parent = thread.parent;
    if (!parent || !("availableTags" in parent)) return [];
    return (thread.appliedTags ?? [])
        .map(id => parent.availableTags.find(t => t.id === id)?.name)
        .filter((n): n is string => Boolean(n));
}

export function hasTag(thread: ThreadChannel, tagName: string): boolean {
    const target = tagName.toLowerCase();
    return getAppliedTagNames(thread).some((name) => name.toLowerCase() === target);
}

export function hasResolvedTag(thread: ThreadChannel): boolean {
    return getAppliedTagNames(thread)
        .map((name) => name.toLowerCase())
        .some((name) => name === "completed" || name === "close" || name === "closed");
}

/** Build a GitHub issue body from a forum post */
export function buildIssueBody(
    content: string,
    authorTag: string,
    tags: string[],
    threadUrl: string
): string {
    const tagSection = tags.length > 0
        ? `**Tags:** ${tags.map(t => `\`${t}\``).join(", ")}\n`
        : "";

    return [
        `> **Reported by:** ${authorTag}`,
        `> **Discord Thread:** ${threadUrl}`,
        tagSection,
        "---",
        "",
        content || "_No description provided._",
    ].join("\n");
}

/** Preserve Discord markdown when sending reply content to GitHub. */
export function normalizeDiscordMarkdownForGithub(content: string): string {
    const normalized = content.replace(/\r\n/g, "\n").trim();
    return normalized || "_No text content._";
}

/**
 * Normalize GitHub markdown for Discord embed rendering.
 * Discord embed markdown is more limited than GitHub markdown.
 */
export function normalizeGithubMarkdownForDiscord(content: string): string {
    let normalized = content.replace(/\r\n/g, "\n").trim();
    if (!normalized) return "_No text content._";

    // Headings are not consistently rendered in embeds; make them explicit.
    normalized = normalized.replace(/^#{1,6}\s+(.+)$/gm, "**$1**");
    // Convert GitHub task-list markers into readable emoji bullets.
    normalized = normalized.replace(/^- \[ \]\s+/gm, "- ⬜ ");
    normalized = normalized.replace(/^- \[x\]\s+/gim, "- ✅ ");

    return normalized;
}

/** Build a GitHub comment body from a Discord reply */
export function buildCommentBody(content: string, authorTag: string): string {
    const markdownContent = normalizeDiscordMarkdownForGithub(content);
    return `> **Discord reply by:** ${authorTag}\n\n${markdownContent}`;
}
