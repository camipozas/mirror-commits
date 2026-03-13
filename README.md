# mirror-commits

Mirror work GitHub contributions to your personal profile's contribution graph — without leaking any proprietary code.

Creates empty, backdated commits in a private mirror repo on your personal account, one per work commit.

## Setup

```bash
pnpm install
```

### Interactive

```bash
pnpm mirror init
```

### Non-interactive (flags)

```bash
pnpm mirror init \
  --work-org YourOrg \
  --work-emails you@company.com \
  --work-user your-work-gh \
  --personal your-personal-gh \
  --personal-email you@gmail.com \
  --repo-name work-mirror
```

## Usage

```bash
# Incremental sync (since last run)
pnpm mirror sync

# Full re-sync from scratch
pnpm mirror sync --full

# Preview without writing
pnpm mirror sync --dry-run

# Check status
pnpm mirror status

# Schedule daily sync (macOS launchd, default 10pm)
pnpm mirror schedule install --hour 22
pnpm mirror schedule status
pnpm mirror schedule remove
```

## Global CLI

A `bin/mirror` wrapper lets you run the CLI from any directory:

```bash
# Option 1: shell alias (add to ~/.zshrc or ~/.zsh_custom/mirror.zsh)
alias mirror='~/Documents/other/mirror-commits/bin/mirror'

# Then from anywhere:
mirror sync
mirror status
```

## MCP Server

The project exposes an MCP server with 7 tools (`mirror_init`, `mirror_sync`, `mirror_status`, `mirror_schedule`, `mirror_list_repos`, `mirror_config`, `mirror_log`).

### Register in Claude Code

Add to `~/.claude.json` under `projects."/Users/<you>".mcpServers`:

```json
"mirror-commits": {
  "type": "stdio",
  "command": "/bin/bash",
  "args": [
    "-c",
    "cd /Users/<you>/Documents/other/mirror-commits && npx tsx src/mcp/index.ts"
  ],
  "env": {
    "PATH": "/Users/<you>/.nvm/versions/node/<version>/bin:/usr/local/bin:/usr/bin:/bin"
  }
}
```

Replace `<you>` with your username and `<version>` with your Node.js version.

### Run standalone

```bash
pnpm mcp
```

## How it works

1. Searches GitHub for commits authored by your work email(s) in your work org
2. For each commit, creates an empty commit in a private mirror repo on your personal account
3. Sets `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` to the original commit date
4. Sets `GIT_AUTHOR_EMAIL` and `GIT_COMMITTER_EMAIL` to your personal email
5. Pushes to the mirror repo — GitHub counts these toward your personal contribution graph

## Configuration

`mirror.config.json` (created by `init`):

| Field | Description |
|-------|-------------|
| `workEmails` | Email(s) used to search for your work commits |
| `workOrg` | GitHub org that owns your work repos |
| `workGhUser` | Your work `gh` CLI username |
| `personalAccount` | Your personal GitHub username |
| `mirrorRepoName` | Name of the private mirror repo |
| `personalEmail` | Email set on mirror commits (must be verified on your GitHub account) |
| `excludeRepos` | Repos to skip (e.g. `["OrgName/secret-repo"]`) |

## Tests

```bash
pnpm test
```

## License

MIT
