import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	addRemote,
	commitCount,
	createEmptyCommit,
	initMirrorRepo,
} from "@/src/core/git";

const exec = promisify(execFile);

let tempDir: string;

afterEach(async () => {
	if (tempDir) await rm(tempDir, { recursive: true });
});

describe("initMirrorRepo", () => {
	it("creates a git repo with README and initial commit", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-git-"));
		const repoPath = join(tempDir, "test-repo");

		await initMirrorRepo(repoPath);

		const readme = await readFile(join(repoPath, "README.md"), "utf-8");
		expect(readme).toContain("Work Mirror");

		const { stdout: branch } = await exec("git", ["branch", "--show-current"], {
			cwd: repoPath,
		});
		expect(branch.trim()).toBe("main");

		const { stdout: log } = await exec("git", ["log", "--oneline"], {
			cwd: repoPath,
		});
		expect(log).toContain("init: mirror repository");
	});
});

describe("createEmptyCommit", () => {
	it("creates an empty commit with the correct date", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-git-"));
		const repoPath = join(tempDir, "test-repo");
		await initMirrorRepo(repoPath);

		const testDate = "2025-06-15T14:30:00Z";
		await createEmptyCommit(repoPath, testDate);

		const { stdout: log } = await exec(
			"git",
			["log", "-1", "--format=%s|%aI|%cI"],
			{ cwd: repoPath },
		);
		const [msg, authorDate, committerDate] = log.trim().split("|");
		expect(msg).toBe("chore: add mirror at 2025-06-15");
		expect(authorDate).toContain("2025-06-15");
		expect(committerDate).toContain("2025-06-15");
	});

	it("should set author email and name when provided", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-git-"));
		const repoPath = join(tempDir, "test-repo");
		await initMirrorRepo(repoPath);

		await createEmptyCommit(
			repoPath,
			"2025-06-15T14:30:00Z",
			"personal@example.com",
			"personal-user",
		);

		const { stdout: log } = await exec(
			"git",
			["log", "-1", "--format=%ae|%an|%ce|%cn"],
			{ cwd: repoPath },
		);
		const [authorEmail, authorName, committerEmail, committerName] = log
			.trim()
			.split("|");
		expect(authorEmail).toBe("personal@example.com");
		expect(authorName).toBe("personal-user");
		expect(committerEmail).toBe("personal@example.com");
		expect(committerName).toBe("personal-user");
	});
});

describe("commitCount", () => {
	it("returns 0 for nonexistent path", async () => {
		tempDir = "";
		const count = await commitCount("/nonexistent/path");
		expect(count).toBe(0);
	});

	it("counts commits in repo", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-git-"));
		const repoPath = join(tempDir, "test-repo");
		await initMirrorRepo(repoPath);
		await createEmptyCommit(repoPath, "2025-01-01T00:00:00Z");
		await createEmptyCommit(repoPath, "2025-01-02T00:00:00Z");

		const count = await commitCount(repoPath);
		expect(count).toBe(3); // init + 2 empty commits
	});
});

describe("addRemote", () => {
	it("adds a remote origin", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-git-"));
		const repoPath = join(tempDir, "test-repo");
		await initMirrorRepo(repoPath);

		await addRemote(repoPath, "https://github.com/test/repo.git");

		const { stdout } = await exec("git", ["remote", "-v"], {
			cwd: repoPath,
		});
		expect(stdout).toContain("https://github.com/test/repo.git");
	});

	it("updates remote if already exists", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-git-"));
		const repoPath = join(tempDir, "test-repo");
		await initMirrorRepo(repoPath);

		await addRemote(repoPath, "https://github.com/test/old.git");
		await addRemote(repoPath, "https://github.com/test/new.git");

		const { stdout } = await exec("git", ["remote", "-v"], {
			cwd: repoPath,
		});
		expect(stdout).toContain("https://github.com/test/new.git");
	});
});
