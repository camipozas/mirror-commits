import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "@/src/core/config";

let tempDir: string;

afterEach(async () => {
	if (tempDir) await rm(tempDir, { recursive: true });
});

describe("loadConfig", () => {
	it("loads and validates a valid config file", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-cfg-"));
		const configPath = join(tempDir, "mirror.config.json");
		await writeFile(
			configPath,
			JSON.stringify({
				workEmails: ["test@example.com"],
				workOrg: "my-org",
				workGhUser: "work-user",
				personalAccount: "personal-user",
				mirrorRepoName: "mirror",
			}),
		);
		const config = await loadConfig(configPath);
		expect(config.workOrg).toBe("my-org");
		expect(config.excludeRepos).toEqual([]);
	});

	it("throws on invalid config", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "mirror-cfg-"));
		const configPath = join(tempDir, "mirror.config.json");
		await writeFile(configPath, JSON.stringify({ workOrg: "" }));
		await expect(loadConfig(configPath)).rejects.toThrow();
	});

	it("throws when file does not exist", async () => {
		tempDir = "";
		await expect(loadConfig("/nonexistent/path/config.json")).rejects.toThrow();
	});
});
