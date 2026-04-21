import {
  type AccountManager,
  type CommitInfo,
  type CommitSource,
  type RepoManager,
  SEARCH_RESULT_CAP,
  searchWithAutoChunk,
  toSearchDate,
} from '@/src/core/github';
import type { GitHubClient } from '@/src/lib/github-api';

/**
 * {@link AccountManager} backed by GitHub REST API tokens.
 *
 * @description Holds two pre-authenticated {@link GitHubClient} instances
 * (work + personal). `switchTo()` is a no-op because each API call already
 * routes through the correct token. `current()` queries the active client.
 */
export class ApiAccountManager implements AccountManager {
  private readonly clients: Map<string, GitHubClient>;
  private activeUser: string;

  constructor(
    workUser: string,
    workClient: GitHubClient,
    personalUser: string,
    personalClient: GitHubClient
  ) {
    this.clients = new Map([
      [workUser, workClient],
      [personalUser, personalClient],
    ]);
    this.activeUser = workUser;
  }

  async switchTo(user: string): Promise<void> {
    if (this.clients.has(user)) {
      this.activeUser = user;
    }
  }

  async current(): Promise<string> {
    return this.activeUser;
  }
}

/**
 * {@link CommitSource} backed by the GitHub Search API via REST.
 *
 * @description Uses the work token to search for commits. Replicates
 * the year-partitioning logic from `GhCommitSource` to handle the
 * 1000-result search limit.
 */
export class ApiCommitSource implements CommitSource {
  private readonly client: GitHubClient;

  constructor(workClient: GitHubClient) {
    this.client = workClient;
  }

  private async searchRange(
    org: string,
    email: string,
    dateFilter: string
  ): Promise<CommitInfo[]> {
    const commits: CommitInfo[] = [];
    const query = `org:${org} author-email:${email} ${dateFilter}`;
    let page = 1;
    const perPage = 100;

    while (true) {
      const params = new URLSearchParams({
        q: query,
        per_page: String(perPage),
        page: String(page),
      });

      const parsed = await this.client.fetch<{
        total_count: number;
        items: Array<{
          sha?: string;
          commit?: {
            committer?: { date?: string };
            author?: { date?: string };
          };
          repository?: { full_name?: string };
        }>;
      }>(`/search/commits?${params}`, {
        headers: { Accept: 'application/vnd.github.cloak-preview+json' },
      });

      const items = parsed.items ?? [];

      for (const item of items) {
        const sha = item.sha ?? '';
        const date = item.commit?.committer?.date ?? item.commit?.author?.date;
        const repo = item.repository?.full_name ?? 'unknown';
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

  async searchCommits(
    org: string,
    emails: string[],
    since?: string | null,
    until?: string | null
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
        const start = since ? toSearchDate(new Date(since)) : '2008-01-01';
        const end = until
          ? toSearchDate(new Date(until))
          : toSearchDate(new Date());
        const results = await searchWithAutoChunk(runRange, start, end);
        addUnique(results);
        continue;
      }

      const probe = await runRange('');
      if (probe.length < SEARCH_RESULT_CAP) {
        addUnique(probe);
      } else {
        const currentYear = new Date().getFullYear();
        for (let year = 2008; year <= currentYear; year++) {
          const yearCommits = await searchWithAutoChunk(
            runRange,
            `${year}-01-01`,
            `${year}-12-31`
          );
          addUnique(yearCommits);
        }
      }
    }

    return commits;
  }

  async listOrgRepos(org: string): Promise<string[]> {
    const repos = await this.client.fetchPaginated<{ full_name: string }>(
      `/orgs/${org}/repos?per_page=100`
    );
    return repos.map((r) => r.full_name);
  }
}

/**
 * {@link RepoManager} backed by the GitHub REST API.
 *
 * @description Uses the personal token to create and check repositories.
 */
export class ApiRepoManager implements RepoManager {
  private readonly client: GitHubClient;

  constructor(personalClient: GitHubClient) {
    this.client = personalClient;
  }

  async createRepo(name: string, isPublic: boolean): Promise<string> {
    // name can be "owner/repo" or just "repo"
    const repoName = name.includes('/') ? name.split('/')[1] : name;
    const result = await this.client.fetch<{ full_name: string }>(
      '/user/repos',
      {
        method: 'POST',
        body: {
          name: repoName,
          private: !isPublic,
          description: 'Mirror of work contributions for GitHub profile',
          auto_init: false,
        },
      }
    );
    return result.full_name;
  }

  async repoExists(fullName: string): Promise<boolean> {
    try {
      await this.client.fetch(`/repos/${fullName}`);
      return true;
    } catch {
      return false;
    }
  }
}
