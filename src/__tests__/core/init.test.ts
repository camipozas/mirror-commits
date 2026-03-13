import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InitDependencies, InitOptions } from "@/src/core/init";
import { InitRunner } from "@/src/core/init";

// Stub dependencies
function createMockDeps(): InitDependencies {
	return {
		gitOps: {
			initMirrorRepo: vi.fn().mockResolvedValue(undefined),
			addRemote: vi.fn().mockResolvedValue(undefined),
			createEmptyCommit: vi.fn().mockResolvedValue(undefined),
			push: vi.fn().mockResolvedValue(undefined),
			commitCount: vi.fn().mockResolvedValue(0),
		},
		accountManager: {
			switchTo: vi.fn().mockResolvedValue(undefined),
			current: vi.fn().mockResolvedValue("work-user"),
		},
		repoManager: {
			createRepo: vi.fn().mockResolvedValue("created"),
			repoExists: vi.fn().mockResolvedValue(false),
		},
		stateStore: {
			load: vi.fn().mockResolvedValue({
				lastSyncedAt: null,
				totalCommitsMirrored: 0,
				mirrorRepoPath: "",
			}),
			save: vi.fn().mockResolvedValue(undefined),
		},
		syncFn: vi.fn().mockResolvedValue({
			commitsFound: 10,
			commitsMirrored: 10,
			dryRun: false,
			since: null,
		}),
	};
}

const defaultOptions: InitOptions = {
	workOrg: "test-org",
	workEmails: ["test@example.com"],
	workGhUser: "work-user",
	personalAccount: "personal-user",
	mirrorRepoName: "work-mirror",
	personalEmail: "personal@example.com",
};

describe("InitRunner", () => {
	let deps: InitDependencies;

	beforeEach(() => {
		deps = createMockDeps();
	});

	it("creates repo when it does not exist", async () => {
		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, false);

		expect(deps.repoManager.repoExists).toHaveBeenCalledWith(
			"personal-user/work-mirror",
		);
		expect(deps.repoManager.createRepo).toHaveBeenCalledWith(
			"personal-user/work-mirror",
			false,
		);
	});

	it("skips repo creation when it already exists", async () => {
		vi.mocked(deps.repoManager.repoExists).mockResolvedValue(true);

		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, false);

		expect(deps.repoManager.createRepo).not.toHaveBeenCalled();
	});

	it("initializes local repo and pushes", async () => {
		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, false);

		expect(deps.gitOps.initMirrorRepo).toHaveBeenCalledWith(
			expect.stringContaining("work-mirror"),
		);
		expect(deps.gitOps.addRemote).toHaveBeenCalledWith(
			expect.stringContaining("work-mirror"),
			"https://github.com/personal-user/work-mirror.git",
		);
		expect(deps.gitOps.push).toHaveBeenCalled();
	});

	it("saves state with mirror repo path", async () => {
		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, false);

		expect(deps.stateStore.save).toHaveBeenCalledWith(
			expect.objectContaining({
				mirrorRepoPath: expect.stringContaining("work-mirror"),
			}),
		);
	});

	it("switches accounts correctly", async () => {
		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, false);

		const switchCalls = vi.mocked(deps.accountManager.switchTo).mock.calls;
		// Should switch to personal for repo creation, then back to work
		expect(switchCalls).toEqual(
			expect.arrayContaining([["personal-user"], ["work-user"]]),
		);
	});

	it("auto-syncs when autoSync is true", async () => {
		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, true);

		expect(deps.syncFn).toHaveBeenCalledWith(
			expect.objectContaining({ full: true }),
		);
	});

	it("skips sync when autoSync is false", async () => {
		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, false);

		expect(deps.syncFn).not.toHaveBeenCalled();
	});

	it("switches to work account when not already active", async () => {
		vi.mocked(deps.accountManager.current).mockResolvedValue("some-other-user");

		const runner = new InitRunner(deps);
		await runner.run(defaultOptions, false);

		expect(deps.accountManager.switchTo).toHaveBeenCalledWith("work-user");
	});
});
