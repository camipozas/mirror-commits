import { describe, expect, it } from "vitest";
import { configSchema, stateSchema } from "@/src/lib/schema";

describe("configSchema", () => {
	const validConfig = {
		workEmails: ["cpozas@riamoneytransfer.com"],
		workOrg: "Euronet-RiaDigital-Product",
		workGhUser: "CPozas_euronet",
		personalAccount: "camipozas",
		mirrorRepoName: "work-mirror",
	};

	it("parses a valid config", () => {
		const result = configSchema.parse(validConfig);
		expect(result.workOrg).toBe("Euronet-RiaDigital-Product");
		expect(result.excludeRepos).toEqual([]);
	});

	it("accepts optional excludeRepos", () => {
		const result = configSchema.parse({
			...validConfig,
			excludeRepos: ["some-repo"],
		});
		expect(result.excludeRepos).toEqual(["some-repo"]);
	});

	it("rejects missing workEmails", () => {
		const { workEmails, ...rest } = validConfig;
		expect(() => configSchema.parse(rest)).toThrow();
	});

	it("rejects empty workEmails array", () => {
		expect(() =>
			configSchema.parse({ ...validConfig, workEmails: [] }),
		).toThrow();
	});

	it("rejects invalid email format", () => {
		expect(() =>
			configSchema.parse({ ...validConfig, workEmails: ["not-an-email"] }),
		).toThrow();
	});

	it("rejects empty workOrg", () => {
		expect(() => configSchema.parse({ ...validConfig, workOrg: "" })).toThrow();
	});
});

describe("stateSchema", () => {
	it("parses a valid state", () => {
		const result = stateSchema.parse({
			lastSyncedAt: "2026-03-13T00:00:00Z",
			totalCommitsMirrored: 42,
			mirrorRepoPath: "/some/path",
		});
		expect(result.totalCommitsMirrored).toBe(42);
	});

	it("accepts null lastSyncedAt", () => {
		const result = stateSchema.parse({
			lastSyncedAt: null,
			totalCommitsMirrored: 0,
			mirrorRepoPath: "",
		});
		expect(result.lastSyncedAt).toBeNull();
	});
});
