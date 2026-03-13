import chalk from "chalk";
import { type ConfigLoader, FileConfigLoader } from "@/src/core/config";
import {
	type GitOperations,
	addRemote,
	commitCount,
	createEmptyCommit,
	initMirrorRepo,
	push,
} from "@/src/core/git";
import {
	type AccountManager,
	type CommitSource,
	currentAccount,
	listOrgRepos,
	searchCommits,
	switchAccount,
} from "@/src/core/github";
import { type StateStore, FileStateStore } from "@/src/core/state";

/**
 * Options accepted by {@link sync}.
 */
export interface SyncOptions {
	/**
	 * When `true`, performs a full re-sync from the beginning of history,
	 * ignoring the stored `lastSyncedAt` cursor.
	 *
	 * @default false
	 */
	full?: boolean;

	/**
	 * When `true`, logs what would be mirrored without writing any commits
	 * or pushing to the remote.
	 *
	 * @default false
	 */
	dryRun?: boolean;

	/**
	 * Override the sync start date. Takes precedence over `lastSyncedAt`
	 * from the state file, but is ignored when `full` is `true`.
	 */
	since?: string;

	/**
	 * Path to the config JSON file. Defaults to `mirror.config.json` in the
	 * current working directory.
	 */
	configPath?: string;
}

/**
 * Summary returned by {@link sync} after a run completes.
 */
export interface SyncResult {
	/** Number of commits found in the work org (after exclusion filtering). */
	commitsFound: number;
	/** Number of commits actually written to the mirror repo (0 on dry runs). */
	commitsMirrored: number;
	/** Whether this was a dry run. */
	dryRun: boolean;
	/** The ISO date used as the lower bound for the search, or `null` for full sync. */
	since: string | null;
}

/**
 * Dependencies injected into {@link SyncRunner}.
 * Keeping all dependencies behind interfaces allows unit tests to swap in
 * stubs without touching the filesystem or network (Dependency Inversion).
 *
 * `configLoader` is intentionally optional here: when absent, {@link SyncRunner}
 * constructs a {@link FileConfigLoader} at run-time using the `configPath` from
 * {@link SyncOptions}, preserving the ability to pass a config path per-call.
 */
export interface SyncDependencies {
	/** Source of configuration data. When omitted, a file loader is built from `SyncOptions.configPath`. */
	configLoader?: ConfigLoader;
	/** Persistent state store. */
	stateStore: StateStore;
	/** Source of commit data from a VCS host. */
	commitSource: CommitSource;
	/** Account switcher for the `gh` CLI. */
	accountManager: AccountManager;
	/** Git operations used to write mirror commits. */
	gitOps: GitOperations;
}

/**
 * Orchestrates one mirror sync cycle.
 *
 * @description Fetches new work commits, filters excluded repos, creates
 * backdated empty commits in the local mirror repository, and pushes to the
 * personal GitHub remote. All I/O is delegated to injected collaborators,
 * keeping this class focused on orchestration only (Single Responsibility).
 *
 * @example
 * ```ts
 * const runner = new SyncRunner();
 * const result = await runner.run({ dryRun: true });
 * console.log(`Would mirror ${result.commitsFound} commits`);
 * ```
 */
export class SyncRunner {
	private readonly deps: SyncDependencies;

	/**
	 * @param deps - Optional dependency overrides. Production defaults wrap the
	 *   module-level convenience functions so that vitest module mocks continue
	 *   to intercept calls made through this class.
	 */
	constructor(deps?: Partial<SyncDependencies>) {
		// Default implementations delegate entirely to module-level convenience
		// functions rather than instantiating classes. This means vitest's
		// vi.mock() continues to intercept these calls even when called through
		// SyncRunner, without requiring test mocks to export every class.
		const defaultCommitSource: CommitSource = {
			searchCommits: (org, emails, since) => searchCommits(org, emails, since),
			listOrgRepos: (org) => listOrgRepos(org),
		};
		const defaultAccountManager: AccountManager = {
			switchTo: (user) => switchAccount(user),
			current: () => currentAccount(),
		};
		const defaultGitOps: GitOperations = {
			initMirrorRepo: (repoPath) => initMirrorRepo(repoPath),
			addRemote: (repoPath, url) => addRemote(repoPath, url),
			commitCount: (repoPath) => commitCount(repoPath),
			createEmptyCommit: (repoPath, date) => createEmptyCommit(repoPath, date),
			push: (repoPath) => push(repoPath),
		};

		this.deps = {
			// configLoader is intentionally NOT defaulted here — it is resolved
			// at run() time so that options.configPath can be forwarded.
			configLoader: deps?.configLoader,
			stateStore: deps?.stateStore ?? new FileStateStore(),
			commitSource: deps?.commitSource ?? defaultCommitSource,
			accountManager: deps?.accountManager ?? defaultAccountManager,
			gitOps: deps?.gitOps ?? defaultGitOps,
		};
	}

	/**
	 * Execute the sync cycle.
	 *
	 * @param options - Sync behaviour overrides.
	 * @returns A {@link SyncResult} describing what happened.
	 * @throws If the mirror repo path is not set (i.e., `mirror init` was never run).
	 * @throws If any underlying git or GitHub operation fails.
	 */
	async run(options: SyncOptions = {}): Promise<SyncResult> {
		const { stateStore, commitSource, accountManager, gitOps } = this.deps;

		// Resolve config loader at run-time so options.configPath is honoured
		// even when no explicit loader was injected at construction.
		const configLoader =
			this.deps.configLoader ?? new FileConfigLoader(options.configPath);

		const config = await configLoader.load();
		const state = await stateStore.load();

		if (!state.mirrorRepoPath) {
			throw new Error("Mirror repo not initialized. Run `mirror init` first.");
		}

		const since = options.full
			? undefined
			: (options.since ?? state.lastSyncedAt);

		console.log(
			chalk.blue(
				`Fetching commits from ${config.workOrg}${since ? ` since ${since}` : " (full sync)"}...`,
			),
		);

		// Use work account to search commits
		await accountManager.switchTo(config.workGhUser);

		const commits = await commitSource.searchCommits(
			config.workOrg,
			config.workEmails,
			since,
		);

		// Filter excluded repos
		const excluded = new Set(config.excludeRepos);
		const filtered = commits.filter((c) => !excluded.has(c.repo));

		// Sort ascending so commits are written in chronological order
		filtered.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);

		console.log(chalk.blue(`Found ${filtered.length} commits to mirror.`));

		if (options.dryRun) {
			for (const c of filtered) {
				const dateStr = new Date(c.date).toISOString().split("T")[0];
				console.log(chalk.gray(`  Would mirror: ${dateStr}`));
			}
			return {
				commitsFound: filtered.length,
				commitsMirrored: 0,
				dryRun: true,
				since: since ?? null,
			};
		}

		// Write empty commits backdated to each work commit's date
		for (const c of filtered) {
			await gitOps.createEmptyCommit(state.mirrorRepoPath, c.date);
		}

		if (filtered.length > 0) {
			// Push with personal account, then restore work account
			console.log(chalk.blue("Pushing to mirror repo..."));
			await accountManager.switchTo(config.personalAccount);
			await gitOps.push(state.mirrorRepoPath);
			await accountManager.switchTo(config.workGhUser);
		}

		// Persist updated state
		const now = new Date().toISOString();
		state.lastSyncedAt = now;
		state.totalCommitsMirrored += filtered.length;
		await stateStore.save(state);

		console.log(
			chalk.green(
				`Mirrored ${filtered.length} commits. Total: ${state.totalCommitsMirrored}`,
			),
		);

		return {
			commitsFound: filtered.length,
			commitsMirrored: filtered.length,
			dryRun: false,
			since: since ?? null,
		};
	}
}

/**
 * Run one mirror sync cycle with the default production dependencies.
 *
 * @param options - Sync behaviour overrides.
 * @returns A {@link SyncResult} describing the outcome.
 * @throws If the mirror repo is not initialised or an I/O operation fails.
 *
 * @example
 * ```ts
 * const result = await sync({ dryRun: true });
 * console.log(`Would mirror ${result.commitsFound} commits`);
 * ```
 */
export async function sync(options: SyncOptions = {}): Promise<SyncResult> {
	return new SyncRunner().run(options);
}
