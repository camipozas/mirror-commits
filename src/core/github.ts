import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Thin wrapper around the `gh` CLI binary.
 *
 * @param args - Arguments forwarded to `gh`.
 * @param options - Optional execution options.
 * @returns Trimmed stdout of the `gh` invocation.
 * @throws With command context if the `gh` process exits with a non-zero code.
 */
async function gh(
	args: string[],
	options?: { user?: string },
): Promise<string> {
	const env = { ...process.env };
	if (options?.user) {
		env.GH_TOKEN = undefined;
	}
	try {
		const { stdout } = await exec("gh", args, {
			env,
			maxBuffer: 10 * 1024 * 1024,
		});
		return stdout.trim();
	} catch (err) {
		const cmd = `gh ${args.join(" ")}`;
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`${cmd} failed: ${message}`);
	}
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
		try {
			await gh(["auth", "switch", "--user", user]);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(
				`Failed to switch to account "${user}". Check that this account is authenticated: gh auth status\n${message}`,
			);
		}
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
	/**
	 * Run a single date-bounded search query and return all paginated results.
	 * GitHub Search API caps at 1000 results per query, so callers should
	 * partition by year when totals may exceed that limit.
	 */
	private async searchRange(
		org: string,
		email: string,
		dateFilter: string,
	): Promise<CommitInfo[]> {
		const commits: CommitInfo[] = [];
		const query = `org:${org} author-email:${email} ${dateFilter}`;
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
				const date = item.commit?.committer?.date ?? item.commit?.author?.date;
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

		return commits;
	}

	/** {@inheritDoc CommitSource.searchCommits} */
	async searchCommits(
		org: string,
		emails: string[],
		since?: string | null,
	): Promise<CommitInfo[]> {
		const commits: CommitInfo[] = [];

		for (const email of emails) {
			if (since) {
				const results = await this.searchRange(
					org,
					email,
					`committer-date:>${since}`,
				);
				commits.push(...results);
			} else {
				const probe = await this.searchRange(org, email, "");

				if (probe.length < 1000) {
					commits.push(...probe);
				} else {
					const currentYear = new Date().getFullYear();
					const years = Array.from(
						{ length: currentYear - 2008 + 1 },
						(_, i) => 2008 + i,
					);

					const concurrency = 3;
					for (let i = 0; i < years.length; i += concurrency) {
						const batch = years.slice(i, i + concurrency);
						const results = await Promise.all(
							batch.map((year) =>
								this.searchRange(
									org,
									email,
									`committer-date:${year}-01-01..${year}-12-31`,
								),
							),
						);
						for (const r of results) {
							commits.push(...r);
						}
					}
				}
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
