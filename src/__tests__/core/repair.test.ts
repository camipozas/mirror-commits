import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigLoader } from "@/src/core/config";
import type { GitOperations } from "@/src/core/git";
import { RepairRunner } from "@/src/core/repair";
import type { StateStore } from "@/src/core/state";
import type { Config, State } from "@/src/lib/schema";

const defaultConfig: Config = {
	workEmails: ["test@example.com"],
	workOrg: "test-org",
	workGhUser: "work-user",
	personalAccount: "personal-user",
	mirrorRepoName: "work-mirror",
	excludeRepos: [],
	personalEmail: "personal@example.com",
};

function createMockDeps() {
	const configLoader: ConfigLoader = {
		load: vi.fn().mockResolvedValue(defaultConfig),
	};

	const stateStore: StateStore = {
		load: vi.fn().mockResolvedValue({
			lastSyncedAt: "2026-04-13T00:00:00Z",
			totalCommitsMirrored: 100,
			mirrorRepoPath: "/tmp/fake-mirror",
			mirroredShas: ["aaa111"],
		} satisfies State),
		save: vi.fn().mockResolvedValue(undefined),
	};

	const gitOps: GitOperations = {
		initMirrorRepo: vi.fn().mockResolvedValue(undefined),
		addRemote: vi.fn().mockResolvedValue(undefined),
		createEmptyCommit: vi.fn().mockResolvedValue(undefined),
		push: vi.fn().mockResolvedValue(undefined),
		commitCount: vi.fn().mockResolvedValue(0),
		ensureNotAhead: vi.fn().mockResolvedValue(0),
		fsck: vi.fn().mockResolvedValue({ ok: true, errors: [] }),
		reclone: vi.fn().mockResolvedValue(undefined),
	};

	return { configLoader, stateStore, gitOps };
}

beforeEach(() => {
	vi.resetAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("RepairRunner", () => {
	it("throws when mirror repo is not initialized", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.stateStore.load).mockResolvedValue({
			lastSyncedAt: null,
			totalCommitsMirrored: 0,
			mirrorRepoPath: "",
			mirroredShas: [],
		});

		const runner = new RepairRunner(deps);
		await expect(runner.run()).rejects.toThrow("Mirror repo not initialized");
	});

	it("reports healthy when fsck is clean and nothing is ahead", async () => {
		const deps = createMockDeps();

		const runner = new RepairRunner(deps);
		const result = await runner.run();

		expect(result.fsckOk).toBe(true);
		expect(result.recloned).toBe(false);
		expect(result.discardedAhead).toBe(0);
		expect(deps.gitOps.reclone).not.toHaveBeenCalled();
	});

	it("reports orphan commits discarded by ensureNotAhead", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.gitOps.ensureNotAhead).mockResolvedValue(4);

		const runner = new RepairRunner(deps);
		const result = await runner.run();

		expect(result.discardedAhead).toBe(4);
		expect(result.recloned).toBe(false);
	});

	it("re-clones when fsck reports errors", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.gitOps.fsck).mockResolvedValue({
			ok: false,
			errors: ["missing commit 40fdeeca"],
		});

		const runner = new RepairRunner(deps);
		const result = await runner.run();

		expect(result.fsckOk).toBe(false);
		expect(result.recloned).toBe(true);
		expect(result.remoteUrl).toBe(
			"https://github.com/personal-user/work-mirror.git",
		);
		expect(deps.gitOps.reclone).toHaveBeenCalledWith(
			"/tmp/fake-mirror",
			"https://github.com/personal-user/work-mirror.git",
		);
	});

	it("force re-clones without running fsck", async () => {
		const deps = createMockDeps();

		const runner = new RepairRunner(deps);
		const result = await runner.run({ force: true });

		expect(deps.gitOps.fsck).not.toHaveBeenCalled();
		expect(result.recloned).toBe(true);
	});
});
