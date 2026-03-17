import chalk from "chalk";
import { type ConfigLoader, FileConfigLoader } from "@/src/core/config";
import { type GitOperations, SystemGitOperations } from "@/src/core/git";
import {
	type AccountManager,
	type CommitSource,
	GhAccountManager,
	GhCommitSource,
} from "@/src/core/github";
import { FileStateStore, type StateStore } from "@/src/core/state";

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
 * Per-repository commit breakdown included in sync results.
 */
export interface RepoBreakdown {
	/** Full repository name in `owner/repo` format. */
	repo: string;
	/** Number of commits from this repository. */
	count: number;
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
	/** Per-repository breakdown of commits found. */
	repoBreakdown: RepoBreakdown[];
	/** Running total of all mirrored commits (including previous syncs). */
	totalMirrored: number;
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

/** Maximum number of push retry attempts before giving up. */
const MAX_PUSH_RETRIES = 2;

/**
 * Sleep for the given number of milliseconds.
 *
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a per-repo breakdown from a list of commits.
 *
 * @param commits - Filtered commits to summarise.
 * @returns Sorted array of {@link RepoBreakdown} entries (highest count first).
 */
function buildRepoBreakdown(commits: { repo: string }[]): RepoBreakdown[] {
	const counts = new Map<string, number>();
	for (const c of commits) {
		counts.set(c.repo, (counts.get(c.repo) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.map(([repo, count]) => ({ repo, count }))
		.sort((a, b) => b.count - a.count);
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
	 * @param deps - Optional dependency overrides. Production defaults
	 *   instantiate concrete classes directly (no convenience wrappers).
	 */
	constructor(deps?: Partial<SyncDependencies>) {
		this.deps = {
			configLoader: deps?.configLoader,
			stateStore: deps?.stateStore ?? new FileStateStore(),
			commitSource: deps?.commitSource ?? new GhCommitSource(),
			accountManager: deps?.accountManager ?? new GhAccountManager(),
			gitOps: deps?.gitOps ?? new SystemGitOperations(),
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

		await accountManager.switchTo(config.workGhUser);

		const commits = await commitSource.searchCommits(
			config.workOrg,
			config.workEmails,
			since,
		);

		const excluded = new Set(config.excludeRepos);
		for (const repo of excluded) {
			if (!repo.includes("/")) {
				console.log(
					chalk.yellow(
						`Warning: excludeRepos entry "${repo}" should be in org/repo format`,
					),
				);
			}
		}

		const alreadyMirrored = new Set(state.mirroredShas ?? []);
		const filtered = commits.filter(
			(c) => !excluded.has(c.repo) && !alreadyMirrored.has(c.sha),
		);

		filtered.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);

		const repoBreakdown = buildRepoBreakdown(filtered);

		console.log(
			chalk.blue(
				`Found ${filtered.length} commits across ${repoBreakdown.length} repos:`,
			),
		);
		for (const { repo, count } of repoBreakdown) {
			const repoName = repo.includes("/") ? repo.split("/")[1] : repo;
			console.log(chalk.gray(`  ${repoName}  ${count} commits`));
		}

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
				repoBreakdown,
				totalMirrored: state.totalCommitsMirrored,
			};
		}

		for (const c of filtered) {
			await gitOps.createEmptyCommit(
				state.mirrorRepoPath,
				c.date,
				config.personalEmail,
				config.personalAccount,
			);
		}

		if (filtered.length > 0) {
			console.log(chalk.blue(`Pushing ${filtered.length} commits...`));
			await accountManager.switchTo(config.personalAccount);

			await this.pushWithRetry(gitOps, state.mirrorRepoPath);

			await accountManager.switchTo(config.workGhUser);
		}

		const now = new Date().toISOString();
		state.lastSyncedAt = now;
		state.totalCommitsMirrored += filtered.length;
		const shas = new Set(state.mirroredShas ?? []);
		for (const c of filtered) {
			shas.add(c.sha);
		}
		state.mirroredShas = Array.from(shas);
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
			repoBreakdown,
			totalMirrored: state.totalCommitsMirrored,
		};
	}

	/**
	 * Push with exponential backoff retry.
	 *
	 * @param gitOps - Git operations instance.
	 * @param repoPath - Path to the local mirror repository.
	 * @throws After all retries are exhausted.
	 */
	private async pushWithRetry(
		gitOps: GitOperations,
		repoPath: string,
	): Promise<void> {
		let lastError: Error | undefined;
		for (let attempt = 0; attempt <= MAX_PUSH_RETRIES; attempt++) {
			try {
				await gitOps.push(repoPath);
				return;
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				if (attempt < MAX_PUSH_RETRIES) {
					const delay = 1000 * 2 ** attempt;
					console.log(
						chalk.yellow(
							`Push failed (attempt ${attempt + 1}/${MAX_PUSH_RETRIES + 1}), retrying in ${delay}ms...`,
						),
					);
					await sleep(delay);
				}
			}
		}
		throw new Error(
			`Push failed after ${MAX_PUSH_RETRIES + 1} attempts. Commits are written locally but not pushed.\n${lastError?.message}`,
		);
	}
}

/**
 * Run one mirror sync cycle with the default production dependencies.
 *
 * @param options - Sync behaviour overrides.
 * @returns A {@link SyncResult} describing the outcome.
 * @throws If the mirror repo is not initialised or an I/O operation fails.
 */
export async function sync(options: SyncOptions = {}): Promise<SyncResult> {
	return new SyncRunner().run(options);
}
