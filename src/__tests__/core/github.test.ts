import { describe, expect, it, vi } from "vitest";
import {
	type CommitInfo,
	isSearchCapError,
	SEARCH_RESULT_CAP,
	searchWithAutoChunk,
	toSearchDate,
} from "@/src/core/github";
import { isRetryablePushError } from "@/src/core/sync";

/**
 * Build a list of dummy commits whose length matches `count`. SHAs use the
 * range prefix to keep diagnostics readable when a test fails.
 */
function makeCommits(count: number, prefix: string): CommitInfo[] {
	return Array.from({ length: count }, (_, i) => ({
		sha: `${prefix}-${i}`,
		date: "2026-01-01T00:00:00Z",
		repo: "owner/repo",
	}));
}

describe("isSearchCapError", () => {
	it("matches the 1000-result cap message", () => {
		expect(
			isSearchCapError(
				new Error("Only the first 1000 search results are available"),
			),
		).toBe(true);
	});

	it("matches a 422 response against /search/commits", () => {
		expect(
			isSearchCapError(
				new Error("GitHub API 422: GET /search/commits?q=... failed"),
			),
		).toBe(true);
	});

	it("does not match unrelated errors", () => {
		expect(isSearchCapError(new Error("ECONNRESET"))).toBe(false);
		expect(isSearchCapError(new Error("rate limited"))).toBe(false);
	});
});

describe("toSearchDate", () => {
	it("formats a Date as YYYY-MM-DD (UTC)", () => {
		expect(toSearchDate(new Date("2026-04-21T15:00:00Z"))).toBe("2026-04-21");
	});
});

describe("searchWithAutoChunk", () => {
	it("returns results as-is when under the cap", async () => {
		const runRange = vi.fn().mockResolvedValue(makeCommits(5, "small"));

		const results = await searchWithAutoChunk(
			runRange,
			"2026-01-01",
			"2026-03-31",
		);

		expect(results).toHaveLength(5);
		expect(runRange).toHaveBeenCalledTimes(1);
	});

	it("splits when a range hits the cap", async () => {
		const runRange = vi
			.fn()
			.mockResolvedValueOnce(makeCommits(SEARCH_RESULT_CAP, "full"))
			.mockResolvedValueOnce(makeCommits(10, "left"))
			.mockResolvedValueOnce(makeCommits(20, "right"));

		const results = await searchWithAutoChunk(
			runRange,
			"2026-01-01",
			"2026-03-31",
		);

		expect(runRange).toHaveBeenCalledTimes(3);
		expect(results).toHaveLength(30);
	});

	it("splits when GitHub answers 422 on the range", async () => {
		const runRange = vi
			.fn()
			.mockRejectedValueOnce(
				new Error("Only the first 1000 search results are available"),
			)
			.mockResolvedValueOnce(makeCommits(3, "left"))
			.mockResolvedValueOnce(makeCommits(4, "right"));

		const results = await searchWithAutoChunk(
			runRange,
			"2026-02-01",
			"2026-02-28",
		);

		expect(runRange).toHaveBeenCalledTimes(3);
		expect(results).toHaveLength(7);
	});

	it("throws when a single day is still over the cap", async () => {
		const runRange = vi
			.fn()
			.mockResolvedValue(makeCommits(SEARCH_RESULT_CAP, "day"));

		await expect(
			searchWithAutoChunk(runRange, "2026-04-21", "2026-04-21"),
		).rejects.toThrow(/single day/);
	});

	it("propagates non-cap errors without splitting", async () => {
		const runRange = vi.fn().mockRejectedValue(new Error("network down"));

		await expect(
			searchWithAutoChunk(runRange, "2026-01-01", "2026-01-31"),
		).rejects.toThrow("network down");
		expect(runRange).toHaveBeenCalledTimes(1);
	});
});

describe("isRetryablePushError", () => {
	it("flags corrupt-object errors as non-retryable", () => {
		expect(
			isRetryablePushError("fatal: unable to read 40fdeeca650364aeb"),
		).toBe(false);
	});

	it("flags non-fast-forward as non-retryable", () => {
		expect(
			isRetryablePushError(
				"error: failed to push some refs — non-fast-forward",
			),
		).toBe(false);
	});

	it("flags rejected pushes as non-retryable", () => {
		expect(isRetryablePushError("remote rejected main -> main")).toBe(false);
	});

	it("treats network errors as retryable", () => {
		expect(isRetryablePushError("ECONNRESET")).toBe(true);
		expect(isRetryablePushError("fatal: the remote end hung up")).toBe(true);
	});
});
