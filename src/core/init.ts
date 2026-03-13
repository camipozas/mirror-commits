import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { CONFIG_FILE, STATE_DIR } from "@/src/lib/constants";
import type { Config } from "@/src/lib/schema";
import { type GitOperations, SystemGitOperations } from "@/src/core/git";
import {
	type AccountManager,
	type RepoManager,
	GhAccountManager,
	GhRepoManager,
} from "@/src/core/github";
import { type StateStore, FileStateStore } from "@/src/core/state";

/**
 * Parameters required to set up mirror-commits for the first time.
 */
export interface InitOptions {
	/** GitHub organisation that owns your work repositories. */
	workOrg: string;
	/** One or more commit-author email addresses used to find work commits. */
	workEmails: string[];
	/** Work GitHub username (used for `gh auth switch`). */
	workGhUser: string;
	/** Personal GitHub username that will host the mirror repository. */
	personalAccount: string;
	/** Name to give the new mirror repository. */
	mirrorRepoName: string;
}

/**
 * Dependencies injected into {@link InitRunner}.
 */
export interface InitDependencies {
	/** Git operations used to set up the local mirror repository. */
	gitOps: GitOperations;
	/** Account manager for switching between `gh` CLI sessions. */
	accountManager: AccountManager;
	/** Repository manager for creating / checking remote repos. */
	repoManager: RepoManager;
	/** Persistent state store. */
	stateStore: StateStore;
}

/**
 * Orchestrates the one-time `mirror init` setup flow.
 *
 * @description Verifies `gh` authentication, creates the personal mirror
 * repository if it does not exist, initialises a local git repository,
 * pushes the initial commit, writes the config file, and saves state.
 * All I/O is delegated to injected collaborators (Dependency Inversion).
 *
 * @example
 * ```ts
 * const runner = new InitRunner();
 * const msg = await runner.run({
 *   workOrg: "MyOrg",
 *   workEmails: ["me@company.com"],
 *   workGhUser: "me-work",
 *   personalAccount: "me-personal",
 *   mirrorRepoName: "work-mirror",
 * });
 * console.log(msg);
 * ```
 */
export class InitRunner {
	private readonly deps: InitDependencies;

	/**
	 * @param deps - Optional dependency overrides. Production defaults are used
	 *   for any omitted keys.
	 */
	constructor(deps?: Partial<InitDependencies>) {
		this.deps = {
			gitOps: deps?.gitOps ?? new SystemGitOperations(),
			accountManager: deps?.accountManager ?? new GhAccountManager(),
			repoManager: deps?.repoManager ?? new GhRepoManager(),
			stateStore: deps?.stateStore ?? new FileStateStore(),
		};
	}

	/**
	 * Run the initialisation flow.
	 *
	 * @param options - Setup parameters.
	 * @returns A success message instructing the user on the next step.
	 * @throws If `gh` auth verification fails, repo creation fails, or any
	 *   git/filesystem operation fails.
	 */
	async run(options: InitOptions): Promise<string> {
		const { gitOps, accountManager, repoManager, stateStore } = this.deps;
		const { workOrg, workEmails, workGhUser, personalAccount, mirrorRepoName } =
			options;

		const fullRepoName = `${personalAccount}/${mirrorRepoName}`;
		const mirrorRepoPath = join(STATE_DIR, mirrorRepoName);
		const repoUrl = `https://github.com/${fullRepoName}.git`;

		// Verify work account auth
		console.log(chalk.blue("Verifying gh auth..."));
		const active = await accountManager.current();
		if (active !== workGhUser) {
			console.log(chalk.yellow(`Switching to work account (${workGhUser})...`));
			await accountManager.switchTo(workGhUser);
		}
		console.log(chalk.green(`Work account (${workGhUser}) verified.`));

		// Switch to personal account to create the remote repo
		console.log(
			chalk.blue(`Switching to personal account (${personalAccount})...`),
		);
		await accountManager.switchTo(personalAccount);

		const exists = await repoManager.repoExists(fullRepoName);
		if (!exists) {
			console.log(chalk.blue(`Creating repo ${fullRepoName}...`));
			await repoManager.createRepo(fullRepoName, true);
			console.log(chalk.green(`Repo ${fullRepoName} created.`));
		} else {
			console.log(chalk.yellow(`Repo ${fullRepoName} already exists.`));
		}

		// Initialise local mirror repo and push
		console.log(chalk.blue("Initializing local mirror repo..."));
		await gitOps.initMirrorRepo(mirrorRepoPath);
		await gitOps.addRemote(mirrorRepoPath, repoUrl);

		console.log(chalk.blue("Pushing initial commit..."));
		await gitOps.push(mirrorRepoPath);

		// Restore work account session
		await accountManager.switchTo(workGhUser);
		console.log(chalk.green(`Switched back to ${workGhUser}.`));

		// Write config file to disk
		const config: Config = {
			workEmails,
			workOrg,
			workGhUser,
			personalAccount,
			mirrorRepoName,
			excludeRepos: [],
		};
		const configPath = resolve(CONFIG_FILE);
		await writeFile(configPath, JSON.stringify(config, null, 2));
		console.log(chalk.green(`Config written to ${configPath}`));

		// Persist state
		const state = await stateStore.load();
		state.mirrorRepoPath = mirrorRepoPath;
		await stateStore.save(state);
		console.log(chalk.green(`State saved. Mirror repo at ${mirrorRepoPath}`));

		return "Initialized successfully. Run `pnpm mirror sync` to start mirroring.";
	}
}

/**
 * Run the one-time mirror-commits setup flow with production dependencies.
 *
 * @param options - Setup parameters.
 * @returns A success message instructing the user on the next step.
 * @throws If any setup step fails.
 *
 * @example
 * ```ts
 * const msg = await init({
 *   workOrg: "MyOrg",
 *   workEmails: ["me@company.com"],
 *   workGhUser: "me-work",
 *   personalAccount: "me-personal",
 *   mirrorRepoName: "work-mirror",
 * });
 * console.log(msg);
 * ```
 */
export async function init(options: InitOptions): Promise<string> {
	return new InitRunner().run(options);
}
