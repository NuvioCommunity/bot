<div align="center">

<img src="https://raw.githubusercontent.com/NuvioMedia/NuvioTV/refs/heads/dev/assets/brand/app_logo_wordmark.png" alt="Nuvio" width="320" />

<h1>NuvioBot</h1>

<p>A bridge between Nuvio's Discord community forums and GitHub Issues.</p>

[![Stars](https://img.shields.io/github/stars/NuvioCommunity/bot?style=for-the-badge)](https://github.com/NuvioCommunity/bot/stargazers)
[![Issues](https://img.shields.io/github/issues/NuvioCommunity/bot?style=for-the-badge)](https://github.com/NuvioCommunity/bot/issues)
[![License](https://img.shields.io/github/license/NuvioCommunity/bot?style=for-the-badge)](LICENSE)

<p>Discord intake with GitHub-grade tracking, synchronized end to end.</p>

</div>

NuvioBot keeps community feedback and engineering tracking in sync by mirroring forum discussions to GitHub and GitHub updates back to Discord.

## About

NuvioBot is a TypeScript bot used by NuvioMedia to connect support and suggestion conversations in Discord with actionable issue tracking in GitHub.

Instead of splitting context across two places, NuvioBot links them into one workflow.

## Why NuvioMedia Built This

As the Nuvio community grew, most bug reports and feature ideas started in Discord while implementation work happened in GitHub. That created friction:

- Reports had to be copied manually from Discord to GitHub.
- Status updates in GitHub were not visible to forum users.
- Edited messages and follow-up discussion could drift out of sync.

NuvioBot solves this by making Discord the user-friendly intake surface and GitHub the engineering source of truth, while keeping both sides synchronized.

## What It Does

- Creates GitHub issues from new Discord forum posts.
- Mirrors GitHub issues back into the correct Discord forum.
- Syncs comments/replies in both directions.
- Syncs edits for already-linked messages/comments.
- Mirrors closed issue state back to Discord by resolving and locking related threads.

## How Routing Works

- Discord tags can route posts to different repositories (configured in `src/config.ts`).
- GitHub labels can route mirrored issues into the right Discord forum channel.
- Polling intervals and optional sync limits are configurable via `.env`.

## Requirements

- Node.js 18+
- Discord bot token
- GitHub token with Issues read/write access on target repositories

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Set required values in `.env`:

- `DISCORD_TOKEN`
- `GITHUB_TOKEN`

4. Start in development:

```bash
npm run dev
```

5. Build and run in production:

```bash
npm run build
npm start
```

## Docker

Run with Docker Compose:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

## Documentation

Detailed technical and implementation notes are available in `INFO.md`.

## License

Licensed under the GNU General Public License v3.0.
See `LICENSE` for full text.
