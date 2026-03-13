import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Options forwarded to the internal `gh` CLI wrapper.
 */
interface GhExecOptions {
	/** When provided, clears GH_TOKEN so `gh` uses its own token store. */
	user?: string;
}

/**
 * Thin wrapper around the `gh` CLI binary.
 *
 * @param args - Arguments forwarded to `gh`.
 * @param options - Optional execution options.
 * @returns Trimmed stdout of the `gh` invocation.
 * @throws If the `gh` process exits with a non-zero code.
 */
async function gh(args: string[], options?: GhExecOptions): Promise<string> {
	const env = { ...process.env };
	if (options?.user) {
		env.GH_TOKEN = undefined;
	}
	const { stdout } = await exec("gh", args, {
		env,
		maxBuffer: 10 * 1024 * 1024,
	});
	return stdout.trim();
}

/**
 * Contract for switching between named GitHub accounts via the `gh` CLI.
 * Separating account management from data queries satisfies the
 * Interface Segregation principle — consumers that only fetch data never
 * need to depend on auth-switching logic.
 */
export interface AccountManager {
	/**
	 * Switch the active `gh` CLI session to the given username.
	 *
	 * @param user - The GitHub username to activate.
	 * @returns A promise that resolves when the switch completes.
	 * @throws If `gh auth switch` fails.
	 */
	switchTo(user: string): Promise<void>;

	/**
	 * Return the username of the currently active `gh` CLI session.
	 *
	 * @returns The active GitHub username, or `"unknown"` if it cannot be
	 *   determined.
	 */
	current(): Promise<string>;
}

/**
 * {@link AccountManager} implementation backed by the `gh` CLI.
 *
 * @example
 * ```ts
 * const accounts = new GhAccountManager();
 * await accounts.switchTo("CPozas_euronet");
 * const active = await accounts.current(); // "CPozas_euronet"
 * ```
 */
export class GhAccountManager implements AccountManager {
	/** {@inheritDoc AccountManager.switchTo} */
	async switchTo(user: string): Promise<void> {
		await gh(["auth", "switch", "--user", user]);
	}

	/** {@inheritDoc AccountManager.current} */
	async current(): Promise<string> {
		const output = await gh(["auth", "status"]);
		const match = output.match(/Logged in to github\.com account (\S+)/);
		return match?.[1] ?? "unknown";
	}
}

/**
 * A single commit entry returned by the GitHub commit-search API.
 */
export interface CommitInfo {
	/** ISO 8601 date string of when the commit was made. */
	date: string;
	/** Full repository name in `owner/repo` format. */
	repo: string;
}

/**
 * Contract for a source that can provide commit history.
 *
 * This interface follows the Open/Closed principle: callers depend on
 * `CommitSource` rather than a concrete implementation, so a GitLab
 * adapter could be added without modifying sync logic.
 */
export interface CommitSource {
	/**
	 * Search for commits authored by any of the given emails within an org.
	 *
	 * @param org - GitHub organisation to search within.
	 * @param emails - Author email addresses to match.
	 * @param since - Optional ISO date string; only return commits after this date.
	 * @returns An array of matching {@link CommitInfo} objects (may be empty).
	 * @throws If the underlying API call fails.
	 */
	searchCommits(
		org: string,
		emails: string[],
		since?: string | null,
	): Promise<CommitInfo[]>;

	/**
	 * List all repository full names belonging to an organisation.
	 *
	 * @param org - GitHub organisation to list repositories for.
	 * @returns An array of `owner/repo` strings.
	 * @throws If the API call fails.
	 */
	listOrgRepos(org: string): Promise<string[]>;
}

/**
 * {@link CommitSource} implementation backed by the `gh` CLI and the
 * GitHub search/commits REST endpoint.
 *
 * @example
 * ```ts
 * const source = new GhCommitSource();
 * const commits = await source.searchCommits("MyOrg", ["me@company.com"]);
 * ```
 */
export class GhCommitSource implements CommitSource {
	/** {@inheritDoc CommitSource.searchCommits} */
	async searchCommits(
		org: string,
		emails: string[],
		since?: string | null,
	): Promise<CommitInfo[]> {
		const commits: CommitInfo[] = [];

		for (const email of emails) {
			let query = `org:${org} author-email:${email}`;
			if (since) {
				query += ` committer-date:>${since}`;
			}

			let page = 1;
			const perPage = 100;

			while (true) {
				const result = await gh([
					"api",
					"search/commits",
					"-X",
					"GET",
					"-f",
					`q=${query}`,
					"-f",
					`per_page=${perPage}`,
					"-f",
					`page=${page}`,
					"-H",
					"Accept: application/vnd.github.cloak-preview+json",
				]);

				const parsed = JSON.parse(result);
				const items = parsed.items ?? [];

				for (const item of items) {
					const date =
						item.commit?.committer?.date ?? item.commit?.author?.date;
					const repo = item.repository?.full_name ?? "unknown";
					if (date) {
						commits.push({ date, repo });
					}
				}

				if (items.length < perPage || commits.length >= parsed.total_count) {
					break;
				}
				page++;
			}
		}

		return commits;
	}

	/** {@inheritDoc CommitSource.listOrgRepos} */
	async listOrgRepos(org: string): Promise<string[]> {
		const result = await gh([
			"api",
			`/orgs/${org}/repos`,
			"--paginate",
			"-q",
			".[].full_name",
		]);
		return result
			.split("\n")
			.map((r) => r.trim())
			.filter(Boolean);
	}
}

/**
 * Contract for managing GitHub repository existence and creation.
 */
export interface RepoManager {
	/**
	 * Create a new GitHub repository.
	 *
	 * @param name - Full repository name (`owner/repo` or just `repo` for the
	 *   authenticated user's namespace).
	 * @param isPublic - When `true`, the repository is created as public.
	 * @returns The raw output from `gh repo create`.
	 * @throws If repository creation fails.
	 */
	createRepo(name: string, isPublic: boolean): Promise<string>;

	/**
	 * Check whether a repository already exists.
	 *
	 * @param fullName - Full `owner/repo` repository name.
	 * @returns `true` if the repository exists and is accessible, `false` otherwise.
	 */
	repoExists(fullName: string): Promise<boolean>;
}

/**
 * {@link RepoManager} implementation backed by the `gh` CLI.
 *
 * @example
 * ```ts
 * const repos = new GhRepoManager();
 * if (!(await repos.repoExists("camipozas/work-mirror"))) {
 *   await repos.createRepo("camipozas/work-mirror", true);
 * }
 * ```
 */
export class GhRepoManager implements RepoManager {
	/** {@inheritDoc RepoManager.createRepo} */
	async createRepo(name: string, isPublic: boolean): Promise<string> {
		const visibility = isPublic ? "--public" : "--private";
		const result = await gh([
			"repo",
			"create",
			name,
			visibility,
			"--description",
			"Mirror of work contributions for GitHub profile",
		]);
		return result;
	}

	/** {@inheritDoc RepoManager.repoExists} */
	async repoExists(fullName: string): Promise<boolean> {
		try {
			await gh(["repo", "view", fullName, "--json", "name"]);
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * Switch the active `gh` CLI session to `user`.
 *
 * @param user - GitHub username to activate.
 * @returns A promise that resolves when the switch completes.
 *
 * @example
 * ```ts
 * await switchAccount("CPozas_euronet");
 * ```
 */
export async function switchAccount(user: string): Promise<void> {
	return new GhAccountManager().switchTo(user);
}

/**
 * Return the username of the currently active `gh` CLI session.
 *
 * @returns The active GitHub username, or `"unknown"`.
 *
 * @example
 * ```ts
 * const user = await currentAccount(); // "CPozas_euronet"
 * ```
 */
export async function currentAccount(): Promise<string> {
	return new GhAccountManager().current();
}

/**
 * Search for commits authored by any of the given `emails` within `org`.
 *
 * @param org - GitHub organisation to search within.
 * @param emails - Commit-author email addresses to match.
 * @param since - Optional ISO date; only return commits after this date.
 * @returns Array of {@link CommitInfo} objects sorted by the API response order.
 *
 * @example
 * ```ts
 * const commits = await searchCommits("MyOrg", ["me@company.com"], "2024-01-01");
 * ```
 */
export async function searchCommits(
	org: string,
	emails: string[],
	since?: string | null,
): Promise<CommitInfo[]> {
	return new GhCommitSource().searchCommits(org, emails, since);
}

/**
 * List all repository full names (`owner/repo`) in the given organisation.
 *
 * @param org - GitHub organisation to list repositories for.
 * @returns Array of full repository names.
 *
 * @example
 * ```ts
 * const repos = await listOrgRepos("MyOrg");
 * // ["MyOrg/api", "MyOrg/frontend", ...]
 * ```
 */
export async function listOrgRepos(org: string): Promise<string[]> {
	return new GhCommitSource().listOrgRepos(org);
}

/**
 * Create a new GitHub repository.
 *
 * @param name - Full repository name or bare name for the authenticated user.
 * @param isPublic - Whether to create the repository as public.
 * @returns Raw output from `gh repo create`.
 *
 * @example
 * ```ts
 * await createRepo("camipozas/work-mirror", true);
 * ```
 */
export async function createRepo(
	name: string,
	isPublic: boolean,
): Promise<string> {
	return new GhRepoManager().createRepo(name, isPublic);
}

/**
 * Check whether a repository exists and is accessible.
 *
 * @param fullName - Full `owner/repo` repository name.
 * @returns `true` if the repository exists, `false` otherwise.
 *
 * @example
 * ```ts
 * const exists = await repoExists("camipozas/work-mirror"); // true | false
 * ```
 */
export async function repoExists(fullName: string): Promise<boolean> {
	return new GhRepoManager().repoExists(fullName);
}
