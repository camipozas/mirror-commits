# mirror-commits

Mirror work GitHub contributions to your personal profile's contribution graph — without leaking any proprietary code.

Creates empty, backdated commits in a private mirror repo on your personal account, one per work commit.

## How it works

1. Searches GitHub for commits authored by your work email(s) in your work org
2. For each commit, creates an empty commit in a private mirror repo on your personal account
3. Sets `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` to the original commit date
4. Sets `GIT_AUTHOR_EMAIL` and `GIT_COMMITTER_EMAIL` to your personal email
5. Pushes to the mirror repo — GitHub counts these toward your personal contribution graph

## MCP Server (remote)

The easiest way to use mirror-commits. Hosted on Vercel — no local install needed.

### 1. Create two GitHub PATs

Go to [github.com/settings/tokens/new](https://github.com/settings/tokens/new) and create:

| Token | Scope | Purpose |
|-------|-------|---------|
| **Work token** | `repo` | Read access to your org's repos |
| **Personal token** | `repo` | Create and push to the mirror repo |

### 2. Add to your MCP client

Add this to `~/.claude.json` under `mcpServers` (works with Claude Code, Cursor, or any MCP client):

```json
"mirror-commits": {
  "type": "http",
  "url": "https://mirror-commits.vercel.app/api/mcp",
  "headers": {
    "X-GitHub-Work-Token": "ghp_your_work_token",
    "X-GitHub-Personal-Token": "ghp_your_personal_token",
    "X-Config": "{\"workEmails\":[\"you@company.com\"],\"workOrg\":\"YourOrg\",\"workGhUser\":\"your-work-gh\",\"personalAccount\":\"your-personal-gh\",\"mirrorRepoName\":\"work-mirror\",\"personalEmail\":\"you@gmail.com\"}"
  }
}
```

Replace the token placeholders and fill in the `X-Config` JSON with your details. Or use the [config generator](https://mirror-commits.vercel.app) on the landing page.

### Available tools

`mirror_init`, `mirror_sync`, `mirror_status`, `mirror_list_repos`, `mirror_config`

## CLI (local)

Run everything locally via the CLI. Uses the `gh` CLI and `git`.

### Quick start

```bash
git clone https://github.com/camipozas/mirror-commits
cd mirror-commits && pnpm install

# Interactive setup (prompts for accounts, checks auth, creates mirror repo)
pnpm mirror init

# Or non-interactive
pnpm mirror init \
  --work-org YourOrg \
  --work-emails you@company.com \
  --work-user your-work-gh \
  --personal your-personal-gh \
  --personal-email you@gmail.com \
  --repo-name work-mirror
```

### Commands

```bash
pnpm mirror sync            # incremental sync (since last run)
pnpm mirror sync --full     # full re-sync from scratch
pnpm mirror sync --dry-run  # preview without pushing
pnpm mirror status          # check status

# Daily auto-sync (macOS launchd, default 10pm)
pnpm mirror schedule install --hour 22
pnpm mirror schedule status
pnpm mirror schedule remove
```

### Global alias

```bash
# Add to ~/.zshrc
alias mirror='~/path/to/mirror-commits/bin/mirror'

# Then from anywhere:
mirror sync
mirror status
```

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
