import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { DEFAULT_COMMIT_MSG } from "@/src/lib/constants";

const exec = promisify(execFile);

/**
 * Execute a `git` command inside `cwd` with an optional environment overlay.
 *
 * @param args - Arguments to forward to the `git` binary.
 * @param cwd - Working directory for the git command.
 * @param env - Optional key/value pairs merged on top of `process.env`.
 * @returns Trimmed stdout of the command.
 * @throws If git exits with a non-zero exit code.
 */
async function git(
	args: string[],
	cwd: string,
	env?: Record<string, string>,
): Promise<string> {
	const result = await exec("git", args, {
		cwd,
		env: { ...process.env, ...env },
	});
	return result.stdout.trim();
}

/**
 * Contract for git operations required by the mirror-commits sync pipeline.
 *
 * Depending on this interface rather than concrete functions allows the
 * `sync` and `init` modules to be unit-tested with an in-memory stub,
 * satisfying the Dependency Inversion principle.
 */
export interface GitOperations {
	/**
	 * Initialise a new git repository at `repoPath`, create a `main` branch,
	 * and commit an initial README.
	 *
	 * @param repoPath - Absolute path where the repository should be created.
	 * @returns A promise that resolves when initialisation is complete.
	 * @throws If any git command fails.
	 */
	initMirrorRepo(repoPath: string): Promise<void>;

	/**
	 * Add or update the `origin` remote for the repository at `repoPath`.
	 *
	 * @param repoPath - Absolute path to the local repository.
	 * @param repoUrl - Remote URL to set as `origin`.
	 * @returns A promise that resolves when the remote is configured.
	 */
	addRemote(repoPath: string, repoUrl: string): Promise<void>;

	/**
	 * Create an empty (no-file-changes) commit with a backdated timestamp.
	 *
	 * @param repoPath - Absolute path to the local repository.
	 * @param date - ISO 8601 date string used for both author and committer dates.
	 * @param authorEmail - Email to set as GIT_AUTHOR_EMAIL and GIT_COMMITTER_EMAIL.
	 * @param authorName - Name to set as GIT_AUTHOR_NAME and GIT_COMMITTER_NAME.
	 * @returns A promise that resolves when the commit is created.
	 * @throws If the git commit fails.
	 */
	createEmptyCommit(
		repoPath: string,
		date: string,
		authorEmail?: string,
		authorName?: string,
	): Promise<void>;

	/**
	 * Push the local `main` branch to `origin`.
	 *
	 * @param repoPath - Absolute path to the local repository.
	 * @param force - When true, force-push.
	 * @returns A promise that resolves when the push completes.
	 * @throws If the push fails.
	 */
	push(repoPath: string, force?: boolean): Promise<void>;

	/**
	 * Count the number of commits reachable from HEAD.
	 *
	 * @param repoPath - Absolute path to the local repository.
	 * @returns The commit count, or `0` if the repository has no commits yet.
	 */
	commitCount(repoPath: string): Promise<number>;
}

/**
 * {@link GitOperations} implementation that shells out to the system `git` binary.
 *
 * @example
 * ```ts
 * const git = new SystemGitOperations();
 * await git.initMirrorRepo("/tmp/my-mirror");
 * await git.addRemote("/tmp/my-mirror", "https://github.com/user/work-mirror.git");
 * ```
 */
export class SystemGitOperations implements GitOperations {
	/** {@inheritDoc GitOperations.initMirrorRepo} */
	async initMirrorRepo(repoPath: string): Promise<void> {
		await mkdir(repoPath, { recursive: true });
		await git(["init"], repoPath);

		// Ensure the repo has a git identity (CI runners may not have one)
		await git(
			["config", "user.email", "mirror-commits@noreply.github.com"],
			repoPath,
		);
		await git(["config", "user.name", "mirror-commits"], repoPath);

		// Switch to main branch (create if new, checkout if exists)
		try {
			await git(["checkout", "-b", "main"], repoPath);
		} catch {
			await git(["checkout", "main"], repoPath);
			return; // Already initialized — skip README commit
		}

		const readmePath = `${repoPath}/README.md`;
		await writeFile(
			readmePath,
			"# Work Mirror\n\nMirrored contribution timestamps. No proprietary code.\n",
		);
		await git(["add", "README.md"], repoPath);
		await git(["commit", "-m", "init: mirror repository"], repoPath);
	}

	/** {@inheritDoc GitOperations.addRemote} */
	async addRemote(repoPath: string, repoUrl: string): Promise<void> {
		try {
			await git(["remote", "add", "origin", repoUrl], repoPath);
		} catch {
			await git(["remote", "set-url", "origin", repoUrl], repoPath);
		}
	}

	/** {@inheritDoc GitOperations.createEmptyCommit} */
	async createEmptyCommit(
		repoPath: string,
		date: string,
		authorEmail?: string,
		authorName?: string,
	): Promise<void> {
		const isoDate = new Date(date).toISOString();
		const dateStr = isoDate.split("T")[0];
		const msg = `${DEFAULT_COMMIT_MSG} at ${dateStr}`;

		const env: Record<string, string> = {
			GIT_AUTHOR_DATE: isoDate,
			GIT_COMMITTER_DATE: isoDate,
		};

		if (authorEmail) {
			env.GIT_AUTHOR_EMAIL = authorEmail;
			env.GIT_COMMITTER_EMAIL = authorEmail;
		}
		if (authorName) {
			env.GIT_AUTHOR_NAME = authorName;
			env.GIT_COMMITTER_NAME = authorName;
		}

		await git(["commit", "--allow-empty", "-m", msg], repoPath, env);
	}

	/** {@inheritDoc GitOperations.push} */
	async push(repoPath: string, force = false): Promise<void> {
		const args = ["push", "-u", "origin", "main"];
		if (force) args.splice(1, 0, "--force");
		await git(args, repoPath);
	}

	/** {@inheritDoc GitOperations.commitCount} */
	async commitCount(repoPath: string): Promise<number> {
		try {
			const result = await git(["rev-list", "--count", "HEAD"], repoPath);
			return Number.parseInt(result, 10);
		} catch {
			return 0;
		}
	}
}

/**
 * Initialise a new mirror git repository at `repoPath`.
 *
 * @param repoPath - Absolute path to create the repository at.
 * @returns A promise that resolves when the repo is ready.
 *
 * @example
 * ```ts
 * await initMirrorRepo("/home/user/.local/share/mirror-commits/work-mirror");
 * ```
 */
export async function initMirrorRepo(repoPath: string): Promise<void> {
	return new SystemGitOperations().initMirrorRepo(repoPath);
}

/**
 * Add or update the `origin` remote for the repository at `repoPath`.
 *
 * @param repoPath - Absolute path to the local repository.
 * @param repoUrl - Remote URL to set.
 *
 * @example
 * ```ts
 * await addRemote("/tmp/my-mirror", "https://github.com/user/work-mirror.git");
 * ```
 */
export async function addRemote(
	repoPath: string,
	repoUrl: string,
): Promise<void> {
	return new SystemGitOperations().addRemote(repoPath, repoUrl);
}

/**
 * Create an empty commit backdated to `date`.
 *
 * @param repoPath - Absolute path to the local repository.
 * @param date - ISO 8601 date string for `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`.
 * @param authorEmail - Optional email to override GIT_AUTHOR_EMAIL / GIT_COMMITTER_EMAIL.
 * @param authorName - Optional name to override GIT_AUTHOR_NAME / GIT_COMMITTER_NAME.
 */
export async function createEmptyCommit(
	repoPath: string,
	date: string,
	authorEmail?: string,
	authorName?: string,
): Promise<void> {
	return new SystemGitOperations().createEmptyCommit(
		repoPath,
		date,
		authorEmail,
		authorName,
	);
}

/**
 * Push the `main` branch of the local repository to `origin`.
 *
 * @param repoPath - Absolute path to the local repository.
 *
 * @example
 * ```ts
 * await push("/tmp/my-mirror");
 * ```
 */
export async function push(repoPath: string, force = false): Promise<void> {
	return new SystemGitOperations().push(repoPath, force);
}

/**
 * Count commits reachable from HEAD in `repoPath`.
 *
 * @param repoPath - Absolute path to the local repository.
 * @returns The number of commits, or `0` if the repository is empty.
 *
 * @example
 * ```ts
 * const count = await commitCount("/tmp/my-mirror"); // e.g. 42
 * ```
 */
export async function commitCount(repoPath: string): Promise<number> {
	return new SystemGitOperations().commitCount(repoPath);
}
