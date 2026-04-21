import type { FsckReport, GitOperations } from '@/src/core/git';
import { DEFAULT_COMMIT_MSG } from '@/src/lib/constants';
import type { GitHubClient } from '@/src/lib/github-api';

/**
 * {@link GitOperations} backed by the GitHub Git Data API.
 *
 * @description Creates commits and updates refs remotely — no local
 * `git` binary required. Tree SHA is cached so that after the first
 * commit only 1 API call is needed per subsequent commit (plus a
 * single ref update at push time).
 */
export class ApiGitOperations implements GitOperations {
  private readonly client: GitHubClient;
  private readonly treeShaCache = new Map<string, string>();
  private readonly latestSha = new Map<string, string>();

  constructor(personalClient: GitHubClient) {
    this.client = personalClient;
  }

  async initMirrorRepo(repoFullName: string): Promise<void> {
    const readmeContent = Buffer.from(
      '# Work Mirror\n\nMirrored contribution timestamps. No proprietary code.\n'
    ).toString('base64');

    // 1. Create blob
    const blob = await this.client.fetch<{ sha: string }>(
      `/repos/${repoFullName}/git/blobs`,
      {
        method: 'POST',
        body: { content: readmeContent, encoding: 'base64' },
      }
    );

    // 2. Create tree
    const tree = await this.client.fetch<{ sha: string }>(
      `/repos/${repoFullName}/git/trees`,
      {
        method: 'POST',
        body: {
          tree: [
            {
              path: 'README.md',
              mode: '100644',
              type: 'blob',
              sha: blob.sha,
            },
          ],
        },
      }
    );

    // 3. Create commit
    const commit = await this.client.fetch<{ sha: string }>(
      `/repos/${repoFullName}/git/commits`,
      {
        method: 'POST',
        body: {
          message: 'init: mirror repository',
          tree: tree.sha,
        },
      }
    );

    // 4. Create or update ref
    try {
      await this.client.fetch(`/repos/${repoFullName}/git/refs`, {
        method: 'POST',
        body: { ref: 'refs/heads/main', sha: commit.sha },
      });
    } catch {
      await this.client.fetch(`/repos/${repoFullName}/git/refs/heads/main`, {
        method: 'PATCH',
        body: { sha: commit.sha, force: true },
      });
    }

    this.treeShaCache.set(repoFullName, tree.sha);
    this.latestSha.set(repoFullName, commit.sha);
  }

  async addRemote(): Promise<void> {
    // No-op: API operations target the repo directly.
  }

  async createEmptyCommit(
    repoFullName: string,
    date: string,
    authorEmail?: string,
    authorName?: string
  ): Promise<void> {
    const isoDate = new Date(date).toISOString();
    const dateStr = isoDate.split('T')[0];
    const msg = `${DEFAULT_COMMIT_MSG} at ${dateStr}`;

    // Resolve parent SHA (cached from previous commit or fetched from ref)
    let parentSha = this.latestSha.get(repoFullName);
    if (!parentSha) {
      const ref = await this.client.fetch<{ object: { sha: string } }>(
        `/repos/${repoFullName}/git/ref/heads/main`
      );
      parentSha = ref.object.sha;
    }

    // Resolve tree SHA (cached after first commit)
    let treeSha = this.treeShaCache.get(repoFullName);
    if (!treeSha) {
      const parentCommit = await this.client.fetch<{
        tree: { sha: string };
      }>(`/repos/${repoFullName}/git/commits/${parentSha}`);
      treeSha = parentCommit.tree.sha;
      this.treeShaCache.set(repoFullName, treeSha);
    }

    const name = authorName ?? 'mirror-commits';
    const email = authorEmail ?? 'mirror-commits@noreply.github.com';

    const newCommit = await this.client.fetch<{ sha: string }>(
      `/repos/${repoFullName}/git/commits`,
      {
        method: 'POST',
        body: {
          message: msg,
          tree: treeSha,
          parents: [parentSha],
          author: { name, email, date: isoDate },
          committer: { name, email, date: isoDate },
        },
      }
    );

    this.latestSha.set(repoFullName, newCommit.sha);
  }

  async push(repoFullName: string): Promise<void> {
    const sha = this.latestSha.get(repoFullName);
    if (sha) {
      await this.client.fetch(`/repos/${repoFullName}/git/refs/heads/main`, {
        method: 'PATCH',
        body: { sha },
      });
      this.latestSha.delete(repoFullName);
    }
  }

  async commitCount(): Promise<number> {
    // Not reliably available via API without pagination; return 0.
    // Status tool derives count from state instead.
    return 0;
  }

  /**
   * No-op: remote-mode git has no local working tree, so there are no
   * unpushed commits to reconcile.
   */
  async ensureNotAhead(): Promise<number> {
    return 0;
  }

  /**
   * No-op: remote-mode git trusts GitHub's object store.
   */
  async fsck(): Promise<FsckReport> {
    return { ok: true, errors: [] };
  }

  /**
   * Not applicable for API-backed git — there's nothing local to re-clone.
   */
  async reclone(): Promise<void> {
    throw new Error(
      'reclone is not supported in remote mode. Run `mirror repair` locally.'
    );
  }
}
