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
	/** The commit SHA (used for deduplication across emails and syncs). */
	sha: string;
	/** ISO 8601 date string of when the commit was made. */
	date: string;
	/** Full repository name in `owner/repo` format. */
	repo: string;
}

/** GitHub Search API caps any single query at this many results. */
export const SEARCH_RESULT_CAP = 1000;

/**
 * Detect whether an error from GitHub's search endpoint indicates that the
 * caller hit the 1000-result cap (HTTP 422 with the well-known message).
 *
 * @param err - Error thrown by `gh api` or {@link GitHubClient}.
 * @returns `true` when the error matches the cap signature.
 */
export function isSearchCapError(err: unknown): boolean {
	const message =
		err instanceof Error
			? err.message
			: typeof err === "string"
				? err
				: String(err);
	return (
		message.includes("Only the first 1000 search results") ||
		(message.includes("422") && message.includes("/search/commits"))
	);
}

/**
 * Format a `Date` as `YYYY-MM-DD` for the GitHub search `committer-date:`
 * qualifier.
 *
 * @param date - Date to format.
 * @returns ISO date (UTC) with no time component.
 */
export function toSearchDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * Recursively bisect a `[start, end]` date window whenever a single search
 * query returns {@link SEARCH_RESULT_CAP} results (or the API answers 422).
 * Uses day-level granularity; single-day windows that still overflow are
 * surfaced as errors — the caller must widen the exclusion list.
 *
 * @param runRange - Function that runs a single `committer-date:start..end`
 *   query and returns its commits.
 * @param start - ISO date (YYYY-MM-DD) for the lower bound (inclusive).
 * @param end - ISO date (YYYY-MM-DD) for the upper bound (inclusive).
 * @returns Flat list of commits across all sub-ranges.
 */
export async function searchWithAutoChunk(
	runRange: (dateFilter: string) => Promise<CommitInfo[]>,
	start: string,
	end: string,
): Promise<CommitInfo[]> {
	const filter = `committer-date:${start}..${end}`;
	let results: CommitInfo[] | null = null;
	let hitCap = false;
	try {
		results = await runRange(filter);
		hitCap = results.length >= SEARCH_RESULT_CAP;
	} catch (err) {
		if (!isSearchCapError(err)) throw err;
		hitCap = true;
	}

	if (!hitCap && results) return results;

	const startDate = new Date(`${start}T00:00:00Z`);
	const endDate = new Date(`${end}T00:00:00Z`);
	if (startDate >= endDate) {
		throw new Error(
			`GitHub search returned >= ${SEARCH_RESULT_CAP} results for a single day (${start}). Add noisy repos to excludeRepos and retry.`,
		);
	}

	const midMs =
		startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2;
	const mid = new Date(midMs);
	const midDate = toSearchDate(mid);
	const nextDate = toSearchDate(new Date(mid.getTime() + 86_400_000));

	const rightStart = nextDate <= end ? nextDate : end;

	const [left, right] = await Promise.all([
		searchWithAutoChunk(runRange, start, midDate),
		searchWithAutoChunk(runRange, rightStart, end),
	]);
	return [...left, ...right];
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
	 * @param until - Optional ISO date string; only return commits before this date.
	 * @returns An array of matching {@link CommitInfo} objects (may be empty).
	 * @throws If the underlying API call fails.
	 */
	searchCommits(
		org: string,
		emails: string[],
		since?: string | null,
		until?: string | null,
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
				const sha = item.sha ?? "";
				const date = item.commit?.committer?.date ?? item.commit?.author?.date;
				const repo = item.repository?.full_name ?? "unknown";
				if (date && sha) {
					commits.push({ sha, date, repo });
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
		until?: string | null,
	): Promise<CommitInfo[]> {
		const seen = new Set<string>();
		const commits: CommitInfo[] = [];

		const addUnique = (results: CommitInfo[]) => {
			for (const c of results) {
				if (!seen.has(c.sha)) {
					seen.add(c.sha);
					commits.push(c);
				}
			}
		};

		for (const email of emails) {
			const runRange = (dateFilter: string) =>
				this.searchRange(org, email, dateFilter);

			if (since || until) {
				const start = since ? toSearchDate(new Date(since)) : "2008-01-01";
				const end = until
					? toSearchDate(new Date(until))
					: toSearchDate(new Date());
				const results = await searchWithAutoChunk(runRange, start, end);
				addUnique(results);
				continue;
			}

			const probe = await runRange("");
			if (probe.length < SEARCH_RESULT_CAP) {
				addUnique(probe);
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
							searchWithAutoChunk(runRange, `${year}-01-01`, `${year}-12-31`),
						),
					);
					for (const r of results) addUnique(r);
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
