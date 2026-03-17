import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import chalk from "chalk";
import { type GitOperations, SystemGitOperations } from "@/src/core/git";
import {
	type AccountManager,
	GhAccountManager,
	GhRepoManager,
	type RepoManager,
} from "@/src/core/github";
import { FileStateStore, type StateStore } from "@/src/core/state";
import { sync } from "@/src/core/sync";
import { CONFIG_FILE, STATE_DIR } from "@/src/lib/constants";
import type { Config } from "@/src/lib/schema";

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
	/** Personal email used as author/committer on mirror commits. */
	personalEmail: string;
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
	/** Sync function to run after init. */
	syncFn: (options: { full: boolean; configPath?: string }) => Promise<unknown>;
	/** When true, skip gh CLI checks, credential helper, config file write, and console output. */
	remote?: boolean;
}

/**
 * Prompt the user interactively for all init options.
 * Uses node:readline/promises — no extra dependencies needed.
 */
export async function promptForOptions(): Promise<InitOptions> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });

	console.log(chalk.bold("\nmirror-commits setup\n"));

	const prompt = chalk.blue("? ");
	const workOrg = await rl.question(`${prompt}Work GitHub org: `);
	const workEmailsRaw = await rl.question(
		`${prompt}Work email(s) (comma-separated): `,
	);
	const workGhUser = await rl.question(`${prompt}Work gh username: `);
	const personalAccount = await rl.question(`${prompt}Personal gh username: `);
	const mirrorRepoName =
		(await rl.question(`${prompt}Mirror repo name (work-mirror): `)) ||
		"work-mirror";
	const personalEmail = await rl.question(
		`${prompt}Personal email (for commit author): `,
	);

	rl.close();

	const workEmails = workEmailsRaw
		.split(",")
		.map((e) => e.trim())
		.filter(Boolean);

	return {
		workOrg,
		workEmails,
		workGhUser,
		personalAccount,
		mirrorRepoName,
		personalEmail,
	};
}

/**
 * Parse `gh auth status` output and return a set of logged-in usernames.
 */
function parseGhAuthUsers(output: string): Set<string> {
	const users = new Set<string>();
	const regex = /Logged in to github\.com account (\S+)/g;
	for (const match of output.matchAll(regex)) {
		users.add(match[1]);
	}
	return users;
}

/**
 * Check which gh accounts are logged in. Returns set of usernames.
 */
export async function checkGhAccounts(): Promise<Set<string>> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const exec = promisify(execFile);

	try {
		const { stdout, stderr } = await exec("gh", ["auth", "status"], {
			env: { ...process.env },
		});
		return parseGhAuthUsers(stdout + stderr);
	} catch (err: unknown) {
		if (err && typeof err === "object" && "stderr" in err) {
			return parseGhAuthUsers(
				String((err as { stdout?: string }).stdout ?? "") +
					String((err as { stderr?: string }).stderr ?? ""),
			);
		}
		return new Set();
	}
}

/**
 * Spawn `gh auth login` with inherited stdio so the user can complete the browser flow.
 */
export async function runGhLogin(): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			"gh",
			[
				"auth",
				"login",
				"-h",
				"github.com",
				"-w",
				"-s",
				"repo,read:org",
				"-p",
				"ssh",
			],
			{ stdio: "inherit" },
		);
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`gh auth login exited with code ${code}`));
		});
		child.on("error", reject);
	});
}

/**
 * Check that the `gh` CLI is installed.
 *
 * @returns `true` if `gh` is available on PATH.
 */
async function isGhInstalled(): Promise<boolean> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const exec = promisify(execFile);
	try {
		await exec("which", ["gh"]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Run `gh auth setup-git` to configure gh as the git credential helper.
 * This ensures HTTPS pushes use the active gh account's token.
 */
async function setupGitCredentialHelper(): Promise<void> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const exec = promisify(execFile);
	try {
		await exec("gh", ["auth", "setup-git"]);
	} catch {
		// Non-fatal: user may have SSH configured instead
	}
}

/**
 * Orchestrates the one-time `mirror init` setup flow.
 *
 * When no options are provided (interactive mode), prompts the user,
 * checks gh auth, creates the mirror repo, runs init, and auto-syncs.
 */
export class InitRunner {
	private readonly deps: InitDependencies;

	constructor(deps?: Partial<InitDependencies>) {
		this.deps = {
			gitOps: deps?.gitOps ?? new SystemGitOperations(),
			accountManager: deps?.accountManager ?? new GhAccountManager(),
			repoManager: deps?.repoManager ?? new GhRepoManager(),
			stateStore: deps?.stateStore ?? new FileStateStore(),
			syncFn: deps?.syncFn ?? ((opts) => sync(opts)),
			remote: deps?.remote,
		};
	}

	/**
	 * Run the initialisation flow.
	 *
	 * @param options - Setup parameters.
	 * @param autoSync - When true, automatically run a full sync after init. Defaults to true.
	 * @returns A success message.
	 */
	async run(options: InitOptions, autoSync = true): Promise<string> {
		const { gitOps, accountManager, repoManager, stateStore, syncFn, remote } =
			this.deps;
		const {
			workOrg,
			workEmails,
			workGhUser,
			personalAccount,
			mirrorRepoName,
			personalEmail,
		} = options;

		const fullRepoName = `${personalAccount}/${mirrorRepoName}`;
		const mirrorRepoPath = join(STATE_DIR, mirrorRepoName);
		const repoUrl = `https://github.com/${fullRepoName}.git`;
		const messages: string[] = [];

		/** Log a message — prints to console locally, collects for return string remotely. */
		const log = (msg: string) => {
			if (remote) {
				messages.push(msg);
			} else {
				console.log(msg);
			}
		};

		// Prerequisite: check gh CLI (skip in remote mode — no CLI on serverless)
		if (!remote) {
			log(chalk.blue("\nChecking prerequisites..."));
			if (await isGhInstalled()) {
				log(chalk.green("  ✓ gh CLI found"));
			} else {
				throw new Error(
					"gh CLI not found. Install it from https://cli.github.com/ and run `gh auth login` for both accounts.",
				);
			}
		}

		// Verify work account auth
		const active = await accountManager.current();
		if (active !== workGhUser) {
			log(remote ? `Switching to work account (${workGhUser})...` : chalk.yellow(`  Switching to work account (${workGhUser})...`));
			await accountManager.switchTo(workGhUser);
		}
		log(remote ? `✓ Work account (${workGhUser}) authenticated` : chalk.green(`  ✓ Work account (${workGhUser}) authenticated`));

		// Verify personal account auth
		try {
			await accountManager.switchTo(personalAccount);
			log(remote ? `✓ Personal account (${personalAccount}) authenticated` : chalk.green(`  ✓ Personal account (${personalAccount}) authenticated`));
		} catch {
			throw new Error(
				`Personal account "${personalAccount}" is not authenticated.${remote ? "" : " Run: gh auth login"}`,
			);
		}

		log(remote ? `Note: ensure ${personalEmail} is verified on your GitHub account` : chalk.dim(`  Note: ensure ${personalEmail} is verified on your GitHub account`));

		// Ensure gh is configured as git credential helper (skip in remote mode)
		if (!remote) {
			await setupGitCredentialHelper();
		}

		// Write config file (skip in remote mode — config comes from env/headers)
		if (!remote) {
			const config: Config = {
				workEmails,
				workOrg,
				workGhUser,
				personalAccount,
				mirrorRepoName,
				excludeRepos: [],
				personalEmail,
			};
			const configPath = resolve(CONFIG_FILE);
			await writeFile(configPath, JSON.stringify(config, null, 2));
			log(chalk.green(`  ✓ Config saved to ${configPath}`));
		}

		// Check / create mirror repo
		log(remote ? "Setting up mirror repo..." : chalk.blue("\nSetting up mirror repo..."));
		await accountManager.switchTo(personalAccount);

		const exists = await repoManager.repoExists(fullRepoName);
		if (!exists) {
			await repoManager.createRepo(fullRepoName, false);
			log(remote ? `✓ Mirror repo created: ${fullRepoName} (private)` : chalk.green(`  ✓ Mirror repo created: ${fullRepoName} (private)`));
		} else {
			log(remote ? `✓ ${fullRepoName} already exists` : chalk.green(`  ✓ ${fullRepoName} already exists`));
		}

		// Initialise local mirror repo
		await gitOps.initMirrorRepo(mirrorRepoPath);
		await gitOps.addRemote(mirrorRepoPath, repoUrl);
		await gitOps.push(mirrorRepoPath, true);
		log(remote ? `✓ Local clone initialized at ${mirrorRepoPath}` : chalk.green(`  ✓ Local clone initialized at ${mirrorRepoPath}`));

		// Restore work account session
		await accountManager.switchTo(workGhUser);

		// Persist state
		const state = await stateStore.load();
		state.mirrorRepoPath = mirrorRepoPath;
		await stateStore.save(state);
		log(remote ? "✓ State saved" : chalk.green("  ✓ State saved"));

		// Auto-run full sync
		if (autoSync) {
			log(remote ? "Running first sync..." : chalk.blue("\nRunning first sync..."));
			await syncFn({ full: true, configPath: remote ? undefined : resolve(CONFIG_FILE) });
		}

		log(remote ? "Done! Your contribution graph will update within 24h." : chalk.green("\nDone! Your contribution graph will update within 24h."));
		if (!remote) {
			log(chalk.dim("Next: run `mirror schedule install` for daily auto-sync."));
		}

		return remote ? messages.join("\n") : "Initialized successfully.";
	}
}

/**
 * Run the one-time mirror-commits setup flow with production dependencies.
 */
export async function init(
	options: InitOptions,
	autoSync = true,
): Promise<string> {
	return new InitRunner().run(options, autoSync);
}
