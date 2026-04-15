# Nuvio Forum Issues Bot

Syncs Discord forum posts to GitHub issues, and also mirrors GitHub issues back into forum posts with two-way comment mirroring.

## Features

| Feature | How it works |
|---|---|
| **New post → Issue** | A new GitHub issue is created whenever someone posts in the forum |
| **Issue-created embed** | The thread gets a rich embed with repo, tags, and quick links |
| **GitHub issue → Forum post** | New GitHub issues are mirrored into the matching forum automatically |
| **Edit sync** | If OP edits their post, the GitHub issue body updates automatically |
| **Tag routing** | `Android TV` → `NuvioMedia/NuvioTV`; `TizenOS` / `WebOS` → `NuvioMedia/NuvioWeb` |
| **GitHub labels routing** | `bug` → Bugs and Issues forum; `enhancement`/`enchantment`/`help wanted` → Suggestions forum |
| **Discord → GitHub comments** | Forum replies sync to GitHub comments (Discord-origin echoes are skipped on mirror back) |
| **GitHub → Discord comments** | New GitHub comments are mirrored into Discord as rich embeds with author/link metadata |
| **Discord edit -> GitHub edit** | Editing a synced Discord reply updates the linked GitHub comment |
| **GitHub edit -> Discord edit** | Editing a GitHub comment updates the existing Discord embed and adds an edited-on timestamp |
| **Resolved close reason** | If the thread has tag `Completed` or `Close`, closing uses GitHub `state_reason=completed` |
| **Issue close -> Thread close** | If the GitHub issue closes, the linked forum thread is tagged and archived/locked |

## Hardcoded Presets

- Server ID: `1379902184207941732`
- Suggestions forum ID: `1458552157836935359`
- Bugs and Issues forum ID: `1458552195904573513`
- Repo routing: `Android TV` -> `NuvioMedia/NuvioTV`
- Repo routing: `WebOS` -> `NuvioMedia/NuvioWeb`
- Repo routing: `TizenOS` -> `NuvioMedia/NuvioWeb`

## Comment Sync Logic

```
New message in forum thread
├── Bot message?           → ignore
├── commentSyncLocked?     → ignore
├── GitHub-origin thread?  → any non-bot reply can sync to GitHub
└── Discord-origin thread  → only OP replies sync; another user reply locks sync

GitHub issue poll loop
├── New issue in watched repos
├── Select forum using labels: bug/enhancement(enchantment)/help wanted
└── Create mirrored forum post + state mapping

GitHub issue close poll loop
├── Linked issue becomes closed
└── Tag forum post as resolved and lock/archive thread

GitHub comment poll loop
├── New comment detected for tracked issue
├── Comment is Discord-origin marker? → skip (prevents echo loop)
├── New comment -> post rich embed reply in Discord thread
└── Existing comment edited -> update mirrored embed with edited-on marker

Discord message edit flow
├── Starter post edited -> update GitHub issue body
└── Synced reply edited -> update linked GitHub comment
```

## Setup

### 1. Create a Discord bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → New Application → Bot
2. Copy the bot token
3. Under **Privileged Gateway Intents**, enable **Message Content Intent**
4. Invite the bot with scopes `bot` and permissions: Read Messages, Send Messages, Read Message History

### 2. Create a GitHub Personal Access Token

1. GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
2. Grant **Issues: Read & Write** on `NuvioMedia/NuvioTV` and `NuvioMedia/NuvioWeb`

### 3. Configure

```bash
cd NuvioBot
cp .env.example .env
# Fill in DISCORD_TOKEN and GITHUB_TOKEN
```

### 4. Run

```bash
npm install

# Development (hot reload)
npm run dev

# Production
npm run build && npm start
```

## Docker (24/7 Hosting)

### Build and run with Docker Compose

```bash
docker compose up -d --build
```

### View logs

```bash
docker compose logs -f
```

### Stop

```bash
docker compose down
```

Notes:
- Container restarts automatically with `restart: unless-stopped`.
- Persistent bot state is stored in `./data` on the host and mounted to `/app/data` in the container.
- Keep `.env` in the project root with at least `DISCORD_TOKEN` and `GITHUB_TOKEN`.

## File structure

```
forumIssues/
├── src/
│   ├── index.ts                   # Bot entry, Discord event wiring
│   ├── config.ts                  # Presets + tokens + poll settings
│   ├── github.ts                  # Octokit wrapper (issues/comments read/write)
│   ├── state.ts                   # Persistent thread→issue state (data/state.json)
│   ├── utils.ts                   # Tag resolution, body builders
│   └── handlers/
│       ├── forumPostCreate.ts     # Discord forum post -> create GitHub issue
│       ├── forumPostEdit.ts       # Starter message edit -> update issue body
│       ├── forumPostDelete.ts     # Thread/message delete -> close issue
│       ├── forumPostStatusClose.ts# Lock/archive/resolved-tag -> close issue
│       ├── messageCreate.ts       # Forum replies -> GitHub comments
│       ├── messageEdit.ts         # Edited forum replies -> update GitHub comments
│       ├── githubReplySync.ts     # GitHub comments <-> Discord reply embeds
│       └── githubIssueSync.ts     # GitHub issue create/close <-> forum lifecycle
├── data/
│   └── state.json                 # Auto-created at runtime
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## Optional Environment Variables

```bash
# Optional: if unset, OP replies are unlimited
MAX_SELF_REPLIES=25

# Poll interval for GitHub -> Discord reply mirroring
GITHUB_REPLY_POLL_MS=30000

# Poll interval for GitHub issue lifecycle mirroring
GITHUB_ISSUE_POLL_MS=20000
```
