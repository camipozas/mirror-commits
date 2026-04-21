import { type ConfigLoader, FileConfigLoader } from '@/src/core/config';
import { type GitOperations, SystemGitOperations } from '@/src/core/git';
import { FileStateStore, type StateStore } from '@/src/core/state';

/**
 * Options accepted by {@link repair}.
 */
export interface RepairOptions {
  /**
   * Path to the config JSON file. Defaults to `mirror.config.json` in the
   * current working directory.
   */
  configPath?: string;
  /**
   * When `true`, skip the fsck probe and re-clone unconditionally. Useful
   * when fsck reports a clean repo but pushes still fail (e.g. a stray
   * hook, pack index mismatch, or cached credential rejection).
   */
  force?: boolean;
}

/**
 * Summary of actions taken by a single {@link repair} run.
 */
export interface RepairResult {
  /** Number of local-only commits discarded before repair. */
  discardedAhead: number;
  /** Errors reported by `git fsck`, if any. */
  fsckErrors: string[];
  /** Whether the mirror repo's object store passed `git fsck`. */
  fsckOk: boolean;
  /** Whether the mirror repo was re-cloned from `origin`. */
  recloned: boolean;
  /** Remote URL that was (re)cloned, when applicable. */
  remoteUrl: string | null;
}

/**
 * Dependencies injected into {@link RepairRunner}. Mirrors the SyncRunner
 * pattern so tests can stub filesystem and git interactions.
 */
export interface RepairDependencies {
  configLoader?: ConfigLoader;
  gitOps: GitOperations;
  stateStore: StateStore;
}

/**
 * Orchestrates one self-heal cycle: check ahead, fsck, re-clone on failure.
 *
 * @description Runs against the local mirror repo. Remote (`origin`) is
 * treated as the source of truth because the authoritative dedup state
 * lives in `mirroredShas` inside the persisted state file, not in the
 * local working tree.
 */
export class RepairRunner {
  private readonly deps: RepairDependencies;

  /**
   * @param deps - Optional dependency overrides. Production defaults
   *   instantiate concrete classes directly.
   */
  constructor(deps?: Partial<RepairDependencies>) {
    this.deps = {
      configLoader: deps?.configLoader,
      stateStore: deps?.stateStore ?? new FileStateStore(),
      gitOps: deps?.gitOps ?? new SystemGitOperations(),
    };
  }

  /**
   * Execute one repair cycle.
   *
   * @param options - Repair behaviour overrides.
   * @returns A {@link RepairResult} describing what happened.
   * @throws If the mirror repo path is not set (i.e., `mirror init` was never run).
   */
  async run(options: RepairOptions = {}): Promise<RepairResult> {
    const { stateStore, gitOps } = this.deps;
    const configLoader =
      this.deps.configLoader ?? new FileConfigLoader(options.configPath);

    const state = await stateStore.load();
    if (!state.mirrorRepoPath) {
      throw new Error('Mirror repo not initialized. Run `mirror init` first.');
    }

    const discardedAhead = await gitOps.ensureNotAhead(state.mirrorRepoPath);

    const report = options.force
      ? { ok: false, errors: ['forced'] }
      : await gitOps.fsck(state.mirrorRepoPath);

    let recloned = false;
    let remoteUrl: string | null = null;
    if (!report.ok) {
      const config = await configLoader.load();
      remoteUrl = `https://github.com/${config.personalAccount}/${config.mirrorRepoName}.git`;
      await gitOps.reclone(state.mirrorRepoPath, remoteUrl);
      recloned = true;
    }

    return {
      fsckOk: report.ok,
      fsckErrors: report.errors,
      discardedAhead,
      recloned,
      remoteUrl,
    };
  }
}

/**
 * Run one repair cycle with the default production dependencies.
 *
 * @param options - Repair behaviour overrides.
 * @returns A {@link RepairResult} describing the outcome.
 */
export async function repair(
  options: RepairOptions = {}
): Promise<RepairResult> {
  return new RepairRunner().run(options);
}
