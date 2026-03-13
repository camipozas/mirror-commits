import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
vi.mock("@/src/core/github.js", () => ({
	switchAccount: vi.fn(),
	searchCommits: vi.fn(),
}));

vi.mock("@/src/core/git.js", () => ({
	createEmptyCommit: vi.fn(),
	push: vi.fn(),
}));

const mockSearchCommits = vi.mocked(
	(await import("@/src/core/github.js")).searchCommits,
);
const mockSwitchAccount = vi.mocked(
	(await import("@/src/core/github.js")).switchAccount,
);
const mockCreateEmptyCommit = vi.mocked(
	(await import("@/src/core/git.js")).createEmptyCommit,
);
const mockPush = vi.mocked((await import("@/src/core/git.js")).push);

let tempDir: string;
let _tempStateFile: string;
let tempConfigFile: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "mirror-sync-"));
	_tempStateFile = join(tempDir, "state.json");
	tempConfigFile = join(tempDir, "config.json");

	vi.resetAllMocks();
});

afterEach(async () => {
	if (tempDir) await rm(tempDir, { recursive: true });
	vi.restoreAllMocks();
});

// Mock config and state modules with temp paths
vi.mock("@/src/lib/constants.js", async () => {
	const temp = await import("node:fs/promises").then((fs) =>
		fs.mkdtemp(join(tmpdir(), "mirror-const-")),
	);
	return {
		STATE_DIR: temp,
		STATE_FILE: join(temp, "state.json"),
		CONFIG_FILE: "mirror.config.json",
		DEFAULT_COMMIT_MSG: "chore: add mirror",
	};
});

describe("sync", () => {
	it("throws when mirror repo not initialized", async () => {
		const { writeFile } = await import("node:fs/promises");
		await writeFile(
			tempConfigFile,
			JSON.stringify({
				workEmails: ["test@example.com"],
				workOrg: "test-org",
				workGhUser: "work-user",
				personalAccount: "personal-user",
				mirrorRepoName: "mirror",
				personalEmail: "personal@example.com",
			}),
		);

		const { sync } = await import("@/src/core/sync.js");
		await expect(sync({ configPath: tempConfigFile })).rejects.toThrow(
			"Mirror repo not initialized",
		);
	});

	it("returns correct dry run result", async () => {
		const { writeFile } = await import("node:fs/promises");
		const { STATE_FILE } = await import("@/src/lib/constants.js");

		// Write valid state
		await writeFile(
			STATE_FILE,
			JSON.stringify({
				lastSyncedAt: null,
				totalCommitsMirrored: 0,
				mirrorRepoPath: "/tmp/fake-repo",
			}),
		);

		// Write valid config
		await writeFile(
			tempConfigFile,
			JSON.stringify({
				workEmails: ["test@example.com"],
				workOrg: "test-org",
				workGhUser: "work-user",
				personalAccount: "personal-user",
				mirrorRepoName: "mirror",
				personalEmail: "personal@example.com",
			}),
		);

		mockSearchCommits.mockResolvedValue([
			{ date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
			{ date: "2025-06-16T10:00:00Z", repo: "test-org/repo-b" },
		]);

		const { sync } = await import("@/src/core/sync.js");
		const result = await sync({ dryRun: true, configPath: tempConfigFile });

		expect(result.commitsFound).toBe(2);
		expect(result.commitsMirrored).toBe(0);
		expect(result.dryRun).toBe(true);
		expect(mockCreateEmptyCommit).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("creates commits and pushes on real sync", async () => {
		const { writeFile } = await import("node:fs/promises");
		const { STATE_FILE } = await import("@/src/lib/constants.js");

		await writeFile(
			STATE_FILE,
			JSON.stringify({
				lastSyncedAt: null,
				totalCommitsMirrored: 0,
				mirrorRepoPath: "/tmp/fake-repo",
			}),
		);

		await writeFile(
			tempConfigFile,
			JSON.stringify({
				workEmails: ["test@example.com"],
				workOrg: "test-org",
				workGhUser: "work-user",
				personalAccount: "personal-user",
				mirrorRepoName: "mirror",
				personalEmail: "personal@example.com",
			}),
		);

		mockSearchCommits.mockResolvedValue([
			{ date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
		]);

		const { sync } = await import("@/src/core/sync.js");
		const result = await sync({ configPath: tempConfigFile });

		expect(result.commitsMirrored).toBe(1);
		expect(mockCreateEmptyCommit).toHaveBeenCalledOnce();
		expect(mockPush).toHaveBeenCalledOnce();
		expect(mockSwitchAccount).toHaveBeenCalledWith("personal-user");
	});

	it("filters excluded repos", async () => {
		const { writeFile } = await import("node:fs/promises");
		const { STATE_FILE } = await import("@/src/lib/constants.js");

		await writeFile(
			STATE_FILE,
			JSON.stringify({
				lastSyncedAt: null,
				totalCommitsMirrored: 0,
				mirrorRepoPath: "/tmp/fake-repo",
			}),
		);

		await writeFile(
			tempConfigFile,
			JSON.stringify({
				workEmails: ["test@example.com"],
				workOrg: "test-org",
				workGhUser: "work-user",
				personalAccount: "personal-user",
				mirrorRepoName: "mirror",
				excludeRepos: ["test-org/secret-repo"],
				personalEmail: "personal@example.com",
			}),
		);

		mockSearchCommits.mockResolvedValue([
			{ date: "2025-06-15T10:00:00Z", repo: "test-org/repo-a" },
			{ date: "2025-06-16T10:00:00Z", repo: "test-org/secret-repo" },
		]);

		const { sync } = await import("@/src/core/sync.js");
		const result = await sync({ dryRun: true, configPath: tempConfigFile });

		expect(result.commitsFound).toBe(1);
	});
});
