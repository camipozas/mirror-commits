import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigLoader } from "@/src/core/config";
import type { GitOperations } from "@/src/core/git";
import type { AccountManager, CommitSource } from "@/src/core/github";
import type { StateStore } from "@/src/core/state";
import { SyncRunner } from "@/src/core/sync";
import type { Config, State } from "@/src/lib/schema";

const defaultConfig: Config = {
	workEmails: ["test@example.com"],
	workOrg: "test-org",
	workGhUser: "work-user",
	personalAccount: "personal-user",
	mirrorRepoName: "mirror",
	excludeRepos: [],
	personalEmail: "personal@example.com",
};

function createMockDeps() {
	const configLoader: ConfigLoader = {
		load: vi.fn().mockResolvedValue(defaultConfig),
	};

	const stateStore: StateStore = {
		load: vi.fn().mockResolvedValue({
			lastSyncedAt: null,
			totalCommitsMirrored: 0,
			mirrorRepoPath: "/tmp/fake-repo",
			mirroredShas: [],
		} satisfies State),
		save: vi.fn().mockResolvedValue(undefined),
	};

	const commitSource: CommitSource = {
		searchCommits: vi.fn().mockResolvedValue([]),
		listOrgRepos: vi.fn().mockResolvedValue([]),
	};

	const accountManager: AccountManager = {
		switchTo: vi.fn().mockResolvedValue(undefined),
		current: vi.fn().mockResolvedValue("work-user"),
	};

	const gitOps: GitOperations = {
		initMirrorRepo: vi.fn().mockResolvedValue(undefined),
		addRemote: vi.fn().mockResolvedValue(undefined),
		createEmptyCommit: vi.fn().mockResolvedValue(undefined),
		push: vi.fn().mockResolvedValue(undefined),
		commitCount: vi.fn().mockResolvedValue(0),
	};

	return { configLoader, stateStore, commitSource, accountManager, gitOps };
}

beforeEach(() => {
	vi.resetAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("SyncRunner", () => {
	it("throws when mirror repo not initialized", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.stateStore.load).mockResolvedValue({
			lastSyncedAt: null,
			totalCommitsMirrored: 0,
			mirrorRepoPath: "",
			mirroredShas: [],
		});

		const runner = new SyncRunner(deps);
		await expect(runner.run()).rejects.toThrow("Mirror repo not initialized");
	});

	it("returns correct dry run result with repo breakdown", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
			{ sha: "bbb222", date: "2025-06-16T10:00:00Z", repo: "test-org/repo-b" },
		]);

		const runner = new SyncRunner(deps);
		const result = await runner.run({ dryRun: true });

		expect(result.commitsFound).toBe(2);
		expect(result.commitsMirrored).toBe(0);
		expect(result.dryRun).toBe(true);
		expect(result.repoBreakdown).toEqual([
			{ repo: "test-org/repo-a", count: 1 },
			{ repo: "test-org/repo-b", count: 1 },
		]);
		expect(deps.gitOps.createEmptyCommit).not.toHaveBeenCalled();
		expect(deps.gitOps.push).not.toHaveBeenCalled();
	});

	it("creates commits and pushes on real sync", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
		]);

		const runner = new SyncRunner(deps);
		const result = await runner.run();

		expect(result.commitsMirrored).toBe(1);
		expect(result.totalMirrored).toBe(1);
		expect(deps.gitOps.createEmptyCommit).toHaveBeenCalledOnce();
		expect(deps.gitOps.push).toHaveBeenCalledOnce();
		expect(deps.accountManager.switchTo).toHaveBeenCalledWith("personal-user");
	});

	it("saves state only after successful push", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
		]);

		const runner = new SyncRunner(deps);
		await runner.run();

		const pushCallOrder = vi.mocked(deps.gitOps.push).mock
			.invocationCallOrder[0];
		const saveCallOrder = vi.mocked(deps.stateStore.save).mock
			.invocationCallOrder[0];
		expect(pushCallOrder).toBeLessThan(saveCallOrder);
	});

	it("filters excluded repos", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.configLoader.load).mockResolvedValue({
			...defaultConfig,
			excludeRepos: ["test-org/secret-repo"],
		});
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
			{
				sha: "ccc333",
				date: "2025-06-16T10:00:00Z",
				repo: "test-org/secret-repo",
			},
		]);

		const runner = new SyncRunner(deps);
		const result = await runner.run({ dryRun: true });

		expect(result.commitsFound).toBe(1);
	});

	it("retries push on failure then succeeds", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
		]);
		vi.mocked(deps.gitOps.push)
			.mockRejectedValueOnce(new Error("network error"))
			.mockResolvedValueOnce(undefined);

		const runner = new SyncRunner(deps);
		const result = await runner.run();

		expect(result.commitsMirrored).toBe(1);
		expect(deps.gitOps.push).toHaveBeenCalledTimes(2);
	});

	it("throws after exhausting push retries", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
		]);
		vi.mocked(deps.gitOps.push).mockRejectedValue(new Error("network error"));

		const runner = new SyncRunner(deps);
		await expect(runner.run()).rejects.toThrow("Push failed after 3 attempts");
		expect(deps.stateStore.save).not.toHaveBeenCalled();
	});

	it("includes per-repo breakdown with correct counts", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
			{ sha: "bbb222", date: "2025-06-16T10:00:00Z", repo: "test-org/repo-a" },
			{ sha: "ccc333", date: "2025-06-17T10:00:00Z", repo: "test-org/repo-b" },
		]);

		const runner = new SyncRunner(deps);
		const result = await runner.run({ dryRun: true });

		expect(result.repoBreakdown).toEqual([
			{ repo: "test-org/repo-a", count: 2 },
			{ repo: "test-org/repo-b", count: 1 },
		]);
	});

	it("skips commits already in mirroredShas", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.stateStore.load).mockResolvedValue({
			lastSyncedAt: null,
			totalCommitsMirrored: 1,
			mirrorRepoPath: "/tmp/fake-repo",
			mirroredShas: ["aaa111"],
		});
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
			{ sha: "ddd444", date: "2025-06-16T10:00:00Z", repo: "test-org/repo-a" },
		]);

		const runner = new SyncRunner(deps);
		const result = await runner.run();

		expect(result.commitsFound).toBe(1);
		expect(result.commitsMirrored).toBe(1);
		expect(deps.gitOps.createEmptyCommit).toHaveBeenCalledOnce();
	});

	it("persists new SHAs to state after sync", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.commitSource.searchCommits).mockResolvedValue([
			{ sha: "aaa111", date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
		]);

		const runner = new SyncRunner(deps);
		await runner.run();

		const savedState = vi.mocked(deps.stateStore.save).mock.calls[0][0];
		expect(savedState.mirroredShas).toContain("aaa111");
	});
});
