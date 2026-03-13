import { type ConfigLoader, FileConfigLoader } from "@/src/core/config";
import { HeaderConfigLoader } from "@/src/core/config-remote";
import { type GitOperations, SystemGitOperations } from "@/src/core/git";
import { ApiGitOperations } from "@/src/core/git-api";
import {
	type AccountManager,
	type CommitSource,
	GhAccountManager,
	GhCommitSource,
	GhRepoManager,
	type RepoManager,
} from "@/src/core/github";
import {
	ApiAccountManager,
	ApiCommitSource,
	ApiRepoManager,
} from "@/src/core/github-api";
import { FileStateStore, type StateStore } from "@/src/core/state";
import { RemoteStateStore } from "@/src/core/state-remote";
import { GitHubClient } from "@/src/lib/github-api";
import { configSchema } from "@/src/lib/schema";

/**
 * Complete set of dependencies required by every MCP tool.
 *
 * Both local (gh CLI / filesystem) and remote (GitHub REST API / headers)
 * modes satisfy this interface — Liskov Substitution in action.
 */
export interface MirrorDeps {
	accountManager: AccountManager;
	commitSource: CommitSource;
	repoManager: RepoManager;
	gitOps: GitOperations;
	stateStore: StateStore;
	configLoader: ConfigLoader;
	/** When `true`, filesystem-only tools (schedule, log) are omitted. */
	remote: boolean;
}

/**
 * Build dependencies for local (stdio) mode.
 *
 * All implementations shell out to `gh` / `git` and read from the filesystem.
 */
export function buildLocalDeps(): MirrorDeps {
	return {
		accountManager: new GhAccountManager(),
		commitSource: new GhCommitSource(),
		repoManager: new GhRepoManager(),
		gitOps: new SystemGitOperations(),
		stateStore: new FileStateStore(),
		configLoader: new FileConfigLoader(),
		remote: false,
	};
}

/**
 * Build dependencies for remote (HTTP / Vercel) mode.
 *
 * @param workToken - GitHub PAT with `repo, read:org` scope for the work account.
 * @param personalToken - GitHub PAT with `repo` scope for the personal account.
 * @param rawConfig - Parsed JSON from the `X-Config` header.
 */
export function buildRemoteDeps(
	workToken: string,
	personalToken: string,
	rawConfig: unknown,
): MirrorDeps {
	const config = configSchema.parse(rawConfig);
	const repoFullName = `${config.personalAccount}/${config.mirrorRepoName}`;

	const workClient = new GitHubClient(workToken);
	const personalClient = new GitHubClient(personalToken);

	return {
		accountManager: new ApiAccountManager(
			config.workGhUser,
			workClient,
			config.personalAccount,
			personalClient,
		),
		commitSource: new ApiCommitSource(workClient),
		repoManager: new ApiRepoManager(personalClient),
		gitOps: new ApiGitOperations(personalClient),
		stateStore: new RemoteStateStore(personalClient, repoFullName),
		configLoader: new HeaderConfigLoader(rawConfig),
		remote: true,
	};
}
