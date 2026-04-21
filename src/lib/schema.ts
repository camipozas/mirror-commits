import { z } from 'zod/v4';

/**
 * Zod schema for the project-level `mirror.config.json` file.
 *
 * @example
 * ```json
 * {
 *   "workEmails": ["you@company.com"],
 *   "workOrg": "YourOrg",
 *   "workGhUser": "you-work",
 *   "personalAccount": "you-personal",
 *   "mirrorRepoName": "work-mirror",
 *   "excludeRepos": ["YourOrg/secret-repo"]
 * }
 * ```
 */
export const configSchema = z.object({
  /** One or more commit-author emails used to search for your work commits. */
  workEmails: z.array(z.email()).min(1),
  /** GitHub organisation that owns your work repositories. */
  workOrg: z.string().min(1),
  /** Your work GitHub username (used for `gh auth switch`). */
  workGhUser: z.string().min(1),
  /** Your personal GitHub username where the mirror repo lives. */
  personalAccount: z.string().min(1),
  /** Name of the mirror repository on your personal account. */
  mirrorRepoName: z.string().min(1),
  /** Full repo names (org/repo) to exclude from mirroring. Defaults to `[]`. */
  excludeRepos: z.array(z.string()).optional().default([]),
  /** Personal email used as author/committer on mirror commits so they count on the contribution graph. */
  personalEmail: z.email(),
});

/**
 * Parsed and validated mirror configuration.
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Zod schema for the runtime state file stored at `~/.local/share/mirror-commits/state.json`.
 */
export const stateSchema = z.object({
  /** ISO 8601 timestamp of the last successful sync, or `null` if never run. */
  lastSyncedAt: z.string().nullable(),
  /** Running total of commits that have been mirrored across all syncs. */
  totalCommitsMirrored: z.number(),
  /** Absolute path to the local clone of the mirror repository. */
  mirrorRepoPath: z.string(),
  /** Set of work-commit SHAs that have already been mirrored (prevents duplicates on full re-sync or state loss). */
  mirroredShas: z.array(z.string()).optional().default([]),
});

/**
 * Persisted runtime state for the mirror-commits tool.
 */
export type State = z.infer<typeof stateSchema>;
