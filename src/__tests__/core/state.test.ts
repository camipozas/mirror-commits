import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileStateStore, migrateFromLegacyPath } from "@/src/core/state";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "mirror-state-"));
});

afterEach(async () => {
	if (tempDir) await rm(tempDir, { recursive: true });
});

describe("FileStateStore", () => {
	it("returns default state when file does not exist", async () => {
		const store = new FileStateStore(join(tempDir, "state.json"));
		const state = await store.load();
		expect(state.lastSyncedAt).toBeNull();
		expect(state.totalCommitsMirrored).toBe(0);
		expect(state.mirrorRepoPath).toBe("");
	});

	it("reads existing state file", async () => {
		const stateFile = join(tempDir, "state.json");
		await writeFile(
			stateFile,
			JSON.stringify({
				lastSyncedAt: "2026-03-13T00:00:00Z",
				totalCommitsMirrored: 10,
				mirrorRepoPath: "/tmp/mirror",
			}),
		);
		const store = new FileStateStore(stateFile);
		const state = await store.load();
		expect(state.totalCommitsMirrored).toBe(10);
		expect(state.mirrorRepoPath).toBe("/tmp/mirror");
	});

	it("writes state to file and reads it back", async () => {
		const stateFile = join(tempDir, "state.json");
		const store = new FileStateStore(stateFile);

		await store.save({
			lastSyncedAt: "2026-03-13T12:00:00Z",
			totalCommitsMirrored: 5,
			mirrorRepoPath: "/tmp/test-mirror",
			mirroredShas: [],
		});

		const state = await store.load();
		expect(state.totalCommitsMirrored).toBe(5);
		expect(state.mirrorRepoPath).toBe("/tmp/test-mirror");
	});

	it("creates parent directory if it does not exist", async () => {
		const nestedPath = join(tempDir, "nested", "deep", "state.json");
		const store = new FileStateStore(nestedPath);

		await store.save({
			lastSyncedAt: null,
			totalCommitsMirrored: 0,
			mirrorRepoPath: "",
			mirroredShas: [],
		});

		const state = await store.load();
		expect(state.totalCommitsMirrored).toBe(0);
	});
});

describe("migrateFromLegacyPath", () => {
	it("copies legacy file and renames it to .migrated", async () => {
		const legacyFile = join(tempDir, "legacy-state.json");
		const newFile = join(tempDir, "new", "state.json");
		const legacyContent = JSON.stringify({
			lastSyncedAt: "2026-03-13T00:00:00Z",
			totalCommitsMirrored: 42,
			mirrorRepoPath: "/tmp/mirror",
		});
		await writeFile(legacyFile, legacyContent);

		await migrateFromLegacyPath(newFile, legacyFile);

		const copied = await readFile(newFile, "utf-8");
		expect(copied).toBe(legacyContent);

		await expect(access(legacyFile)).rejects.toThrow();
		await expect(access(`${legacyFile}.migrated`)).resolves.toBeUndefined();
	});

	it("is a no-op when the new file already exists", async () => {
		const legacyFile = join(tempDir, "legacy.json");
		const newFile = join(tempDir, "current.json");
		await writeFile(legacyFile, `{"totalCommitsMirrored":1}`);
		await writeFile(newFile, `{"totalCommitsMirrored":2}`);

		await migrateFromLegacyPath(newFile, legacyFile);

		const current = await readFile(newFile, "utf-8");
		expect(current).toBe(`{"totalCommitsMirrored":2}`);
		await expect(access(legacyFile)).resolves.toBeUndefined();
	});

	it("is a no-op when the legacy file does not exist", async () => {
		const legacyFile = join(tempDir, "missing.json");
		const newFile = join(tempDir, "fresh.json");

		await migrateFromLegacyPath(newFile, legacyFile);

		await expect(access(newFile)).rejects.toThrow();
	});
});
