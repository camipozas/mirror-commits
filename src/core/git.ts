import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { promisify } from 'node:util';
import { DEFAULT_COMMIT_MSG } from '@/src/lib/constants';

const exec = promisify(execFile);

/**
 * Execute a `git` command inside `cwd` with an optional environment overlay.
 *
 * @param args - Arguments to forward to the `git` binary.
 * @param cwd - Working directory for the git command.
 * @param env - Optional key/value pairs merged on top of `process.env`.
 * @returns Trimmed stdout of the command.
 * @throws With command context if git exits with a non-zero exit code.
 */
async function git(
  args: string[],
  cwd: string,
  env?: Record<string, string>
): Promise<string> {
  try {
    const result = await exec('git', args, {
      cwd,
      env: { ...process.env, ...env },
    });
    return result.stdout.trim();
  } catch (err) {
    const cmd = `git ${args.join(' ')}`;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${cmd} failed (cwd: ${cwd}): ${message}`);
  }
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
   * Add or update the `origin` remote for the repository at `repoPath`.
   *
   * @param repoPath - Absolute path to the local repository.
   * @param repoUrl - Remote URL to set as `origin`.
   * @returns A promise that resolves when the remote is configured.
   */
  addRemote(repoPath: string, repoUrl: string): Promise<void>;

  /**
   * Count the number of commits reachable from HEAD.
   *
   * @param repoPath - Absolute path to the local repository.
   * @returns The commit count, or `0` if the repository has no commits yet.
   */
  commitCount(repoPath: string): Promise<number>;

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
    authorName?: string
  ): Promise<void>;

  /**
   * Ensure the local mirror repo is not ahead of `origin/main`. When prior
   * pushes failed, unsynced local commits accumulate and eventually break
   * future pushes (non-fast-forward or missing objects). Implementations
   * should fetch `origin`, detect the drift, and hard-reset back to the
   * remote tip when ahead. No-op for implementations without a local
   * working tree (e.g. API-backed git).
   *
   * @param repoPath - Absolute path or identifier of the repository.
   * @returns Number of local-only commits that were discarded (0 when clean).
   */
  ensureNotAhead(repoPath: string): Promise<number>;

  /**
   * Run `git fsck --full` and return a health report. Used by the `repair`
   * command to detect corruption before deciding to re-clone. No-op
   * implementations return `{ ok: true, errors: [] }`.
   *
   * @param repoPath - Absolute path to the local repository.
   * @returns Report with `ok: false` when fsck surfaced any errors.
   */
  fsck(repoPath: string): Promise<FsckReport>;
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
   * Push the local `main` branch to `origin`.
   *
   * @param repoPath - Absolute path to the local repository.
   * @param force - When true, force-push.
   * @returns A promise that resolves when the push completes.
   * @throws If the push fails.
   */
  push(repoPath: string, force?: boolean): Promise<void>;

  /**
   * Wipe the local repository and clone it fresh from `remoteUrl`. Used by
   * the `repair` command to recover from a corrupt object store when the
   * authoritative state lives in `origin`. No-op implementations that do
   * not manage a local working tree should throw.
   *
   * @param repoPath - Absolute path where the repository should be cloned.
   * @param remoteUrl - Remote URL to clone from.
   */
  reclone(repoPath: string, remoteUrl: string): Promise<void>;
}

/**
 * Result of a `git fsck --full` run.
 */
export interface FsckReport {
  /** Lines from stderr that were flagged (empty when `ok` is `true`). */
  errors: string[];
  /** `true` when fsck reported no errors or warnings. */
  ok: boolean;
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
    await git(['init'], repoPath);

    await git(
      ['config', 'user.email', 'mirror-commits@noreply.github.com'],
      repoPath
    );
    await git(['config', 'user.name', 'mirror-commits'], repoPath);

    try {
      await git(['checkout', '-b', 'main'], repoPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already exists')) {
        await git(['checkout', 'main'], repoPath);
        return;
      }
      throw err;
    }

    const readmePath = `${repoPath}/README.md`;
    await writeFile(
      readmePath,
      '# Work Mirror\n\nMirrored contribution timestamps. No proprietary code.\n'
    );
    await git(['add', 'README.md'], repoPath);
    await git(['commit', '-m', 'init: mirror repository'], repoPath);
  }

  /** {@inheritDoc GitOperations.addRemote} */
  async addRemote(repoPath: string, repoUrl: string): Promise<void> {
    try {
      await git(['remote', 'add', 'origin', repoUrl], repoPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already exists')) {
        await git(['remote', 'set-url', 'origin', repoUrl], repoPath);
        return;
      }
      throw err;
    }
  }

  /** {@inheritDoc GitOperations.createEmptyCommit} */
  async createEmptyCommit(
    repoPath: string,
    date: string,
    authorEmail?: string,
    authorName?: string
  ): Promise<void> {
    const isoDate = new Date(date).toISOString();
    const dateStr = isoDate.split('T')[0];
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

    await git(['commit', '--allow-empty', '-m', msg], repoPath, env);
  }

  /** {@inheritDoc GitOperations.push} */
  async push(repoPath: string, force = false): Promise<void> {
    const args = ['push', '-u', 'origin', 'main'];
    if (force) {
      args.splice(1, 0, '--force');
    }
    await git(args, repoPath);
  }

  /** {@inheritDoc GitOperations.commitCount} */
  async commitCount(repoPath: string): Promise<number> {
    try {
      const result = await git(['rev-list', '--count', 'HEAD'], repoPath);
      return Number.parseInt(result, 10);
    } catch (err) {
      console.error(
        `commitCount failed for ${repoPath}:`,
        err instanceof Error ? err.message : err
      );
      return 0;
    }
  }

  /** {@inheritDoc GitOperations.ensureNotAhead} */
  async ensureNotAhead(repoPath: string): Promise<number> {
    try {
      await git(['fetch', 'origin', 'main'], repoPath);
    } catch {
      // No remote yet, or network down: treat as clean. The actual push
      // attempt will surface a more specific error.
      return 0;
    }

    let ahead = 0;
    try {
      const raw = await git(
        ['rev-list', '--count', 'origin/main..HEAD'],
        repoPath
      );
      ahead = Number.parseInt(raw, 10) || 0;
    } catch {
      return 0;
    }

    if (ahead > 0) {
      await git(['reset', '--hard', 'origin/main'], repoPath);
    }
    return ahead;
  }

  /** {@inheritDoc GitOperations.fsck} */
  async fsck(repoPath: string): Promise<FsckReport> {
    try {
      await exec('git', ['fsck', '--full', '--strict'], {
        cwd: repoPath,
        env: process.env,
      });
      return { ok: true, errors: [] };
    } catch (err) {
      const stderr =
        err && typeof err === 'object' && 'stderr' in err
          ? String((err as { stderr: unknown }).stderr ?? '')
          : err instanceof Error
            ? err.message
            : String(err);
      const errors = stderr
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return { ok: errors.length === 0, errors };
    }
  }

  /** {@inheritDoc GitOperations.reclone} */
  async reclone(repoPath: string, remoteUrl: string): Promise<void> {
    await rm(repoPath, { recursive: true, force: true });
    const parent = dirname(repoPath);
    const target = basename(repoPath);
    await mkdir(parent, { recursive: true });
    await git(['clone', remoteUrl, target], parent);
    await git(
      ['config', 'user.email', 'mirror-commits@noreply.github.com'],
      repoPath
    );
    await git(['config', 'user.name', 'mirror-commits'], repoPath);
  }
}
