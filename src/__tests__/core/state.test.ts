import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { vi } from "vitest";

// Mock the constants to use a temp dir
const tempDir = await mkdtemp(join(tmpdir(), "mirror-test-"));
const mockStateFile = join(tempDir, "state.json");

vi.mock("@/src/lib/constants.js", () => ({
	STATE_FILE: mockStateFile,
}));

const { loadState, saveState } = await import("@/src/core/state.js");

afterEach(async () => {
	try {
		await rm(mockStateFile);
	} catch {}
});

describe("loadState", () => {
	it("returns default state when file does not exist", async () => {
		const state = await loadState();
		expect(state.lastSyncedAt).toBeNull();
		expect(state.totalCommitsMirrored).toBe(0);
		expect(state.mirrorRepoPath).toBe("");
	});

	it("reads existing state file", async () => {
		await writeFile(
			mockStateFile,
			JSON.stringify({
				lastSyncedAt: "2026-03-13T00:00:00Z",
				totalCommitsMirrored: 10,
				mirrorRepoPath: "/tmp/mirror",
			}),
		);
		const state = await loadState();
		expect(state.totalCommitsMirrored).toBe(10);
		expect(state.mirrorRepoPath).toBe("/tmp/mirror");
	});
});

describe("saveState", () => {
	it("writes state to file", async () => {
		await saveState({
			lastSyncedAt: "2026-03-13T12:00:00Z",
			totalCommitsMirrored: 5,
			mirrorRepoPath: "/tmp/test-mirror",
		});
		const raw = await readFile(mockStateFile, "utf-8");
		const parsed = JSON.parse(raw);
		expect(parsed.totalCommitsMirrored).toBe(5);
	});
});
