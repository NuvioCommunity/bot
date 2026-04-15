import { Client, Events, GatewayIntentBits, ThreadChannel, Message, ForumChannel } from "discord.js";
import { config } from "./config.js";
import { handleForumPostCreate } from "./handlers/forumPostCreate.js";
import { handleForumPostEdit } from "./handlers/forumPostEdit.js";
import { handleForumPostDelete } from "./handlers/forumPostDelete.js";
import { handleForumPostStatusClose } from "./handlers/forumPostStatusClose.js";
import { handleMessageCreate } from "./handlers/messageCreate.js";
import { handleMessageEdit } from "./handlers/messageEdit.js";
import { startGithubIssueSync } from "./handlers/githubIssueSync.js";
import { startGithubReplySync } from "./handlers/githubReplySync.js";

const trackedForumIds = new Set<string>(config.FORUM_CHANNEL_IDS);

function isTrackedForumThread(thread: ThreadChannel): boolean {
    if (!(thread.parent instanceof ForumChannel)) return false;
    if (thread.guildId !== config.SERVER_ID) return false;
    if (!thread.parentId) return false;
    return trackedForumIds.has(thread.parentId);
}

function isResolvedStatusTag(name?: string): boolean {
    const lower = name?.toLowerCase();
    return lower === "completed" || lower === "close" || lower === "closed";
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
});

client.once(Events.ClientReady, (c) => {
    console.log(`[ForumIssues] Ready as ${c.user.tag}`);
    startGithubReplySync(client);
    startGithubIssueSync(client);
});

// New forum post → create GitHub issue
client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    if (!newlyCreated) return;
    if (!isTrackedForumThread(thread as ThreadChannel)) return;
    if (thread.ownerId === client.user?.id) return;

    await handleForumPostCreate(thread as ThreadChannel);
});

// Forum post edited → update GitHub issue body
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!newMsg.channel.isThread()) return;
    const thread = newMsg.channel as ThreadChannel;
    if (!isTrackedForumThread(thread)) return;

    // Determine whether this edit is for the starter/first message or a reply
    const starterMsg = await thread.fetchStarterMessage().catch(() => null);
    const fetched = await newMsg.fetch().catch(() => null);
    if (!fetched) return;

    if (starterMsg && starterMsg.id === newMsg.id) {
        await handleForumPostEdit(thread, fetched);
        return;
    }

    await handleMessageEdit(thread, fetched);
});

// Comments in forum thread → conditionally sync to GitHub
client.on(Events.MessageCreate, async (message) => {
    if (!message.channel.isThread()) return;
    const thread = message.channel as ThreadChannel;
    if (!isTrackedForumThread(thread)) return;

    await handleMessageCreate(thread, message as Message);
});

// Forum thread deleted entirely → close the GitHub issue
client.on(Events.ThreadDelete, async (thread) => {
    if (!isTrackedForumThread(thread as ThreadChannel)) return;

    await handleForumPostDelete(thread as ThreadChannel);
});

// Forum post locked/closed or tagged Completed -> close linked GitHub issue
client.on(Events.ThreadUpdate, async (oldThread, newThread) => {
    if (!isTrackedForumThread(newThread as ThreadChannel)) return;

    const thread = newThread as ThreadChannel;
    const parent = thread.parent;
    if (!(parent instanceof ForumChannel)) return;

    const becameLocked = oldThread.locked !== true && newThread.locked === true;
    const becameArchived = oldThread.archived !== true && newThread.archived === true;

    const availableTags = parent.availableTags;
    const oldTagIds = (oldThread as ThreadChannel).appliedTags ?? [];
    const newTagIds = (newThread as ThreadChannel).appliedTags ?? [];

    const hasResolvedTagByIds = (tagIds: string[]): boolean =>
        tagIds.some((id) => isResolvedStatusTag(availableTags.find((t) => t.id === id)?.name));

    const completedTagAdded = !hasResolvedTagByIds(oldTagIds) && hasResolvedTagByIds(newTagIds);

    if (!becameLocked && !becameArchived && !completedTagAdded) return;

    await handleForumPostStatusClose(thread, {
        becameLocked,
        becameArchived,
        completedTagAdded,
    });
});

// Starter message deleted (without deleting the thread) → close the GitHub issue
client.on(Events.MessageDelete, async (message) => {
    if (!message.channel.isThread()) return;
    const thread = message.channel as ThreadChannel;
    if (!isTrackedForumThread(thread)) return;

    // Only react if the deleted message was the starter/first message
    const starterMsg = await thread.fetchStarterMessage().catch(() => null);
    // If fetchStarterMessage returns null it means it was already deleted
    if (starterMsg !== null) return;

    await handleForumPostDelete(thread as ThreadChannel);
});

client.login(config.DISCORD_TOKEN);
