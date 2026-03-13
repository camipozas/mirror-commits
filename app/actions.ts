"use server";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CONFIG_FILE, STATE_FILE } from "@/src/lib/constants";
import { configSchema, stateSchema } from "@/src/lib/schema";

const exec = promisify(execFile);

/** Result shape returned by all server actions. */
export interface ActionResult {
	success: boolean;
	message: string;
	data?: unknown;
}

/**
 * Whether the server is running locally (has access to filesystem and gh CLI).
 * On Vercel, these actions gracefully degrade with a helpful message.
 */
function isLocal(): boolean {
	return !process.env.VERCEL;
}

/**
 * Load the current mirror config from disk.
 *
 * @returns The parsed config or an error result.
 */
export async function getConfig(): Promise<ActionResult> {
	if (!isLocal()) {
		return {
			success: false,
			message: "Config is only available when running locally (pnpm dev).",
		};
	}
	try {
		const raw = await readFile(resolve(CONFIG_FILE), "utf-8");
		const config = configSchema.parse(JSON.parse(raw));
		return { success: true, message: "Config loaded", data: config };
	} catch {
		return {
			success: false,
			message: "No config found. Run `pnpm mirror init` first.",
		};
	}
}

/**
 * Save an updated config to disk.
 *
 * @param config - The config object to validate and write.
 * @returns Success or error result.
 */
export async function saveConfig(config: unknown): Promise<ActionResult> {
	if (!isLocal()) {
		return {
			success: false,
			message: "Saving config is only available when running locally.",
		};
	}
	try {
		const validated = configSchema.parse(config);
		await writeFile(resolve(CONFIG_FILE), JSON.stringify(validated, null, 2));
		return { success: true, message: "Config saved successfully." };
	} catch (err) {
		return { success: false, message: `Invalid config: ${err}` };
	}
}

/**
 * Load the current sync state.
 *
 * @returns The parsed state or defaults.
 */
export async function getState(): Promise<ActionResult> {
	if (!isLocal()) {
		return {
			success: true,
			message: "State is only available locally",
			data: { lastSyncedAt: null, totalCommitsMirrored: 0, mirrorRepoPath: "" },
		};
	}
	try {
		const raw = await readFile(STATE_FILE, "utf-8");
		const state = stateSchema.parse(JSON.parse(raw));
		return { success: true, message: "State loaded", data: state };
	} catch {
		return {
			success: true,
			message: "No state file yet",
			data: { lastSyncedAt: null, totalCommitsMirrored: 0, mirrorRepoPath: "" },
		};
	}
}

/**
 * Trigger a sync via the CLI (runs as a subprocess).
 *
 * @param dryRun - When true, only preview what would be synced.
 * @returns The CLI output or error.
 */
export async function triggerSync(dryRun: boolean): Promise<ActionResult> {
	if (!isLocal()) {
		return {
			success: false,
			message:
				"Sync requires local access to gh CLI. Run `pnpm mirror sync` locally.",
		};
	}
	try {
		const args = ["tsx", "src/cli/index.ts", "sync"];
		if (dryRun) args.push("--dry-run");

		const { stdout, stderr } = await exec("npx", args, {
			cwd: resolve("."),
			timeout: 120_000,
			env: { ...process.env, FORCE_COLOR: "0" },
		});

		return {
			success: true,
			message: stdout || stderr || "Sync completed.",
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { success: false, message: `Sync failed: ${message}` };
	}
}

/**
 * List repos in the work org via `gh api`.
 *
 * @param org - The GitHub org to list.
 * @returns Array of repo names or error.
 */
export async function listRepos(org: string): Promise<ActionResult> {
	if (!isLocal()) {
		return {
			success: false,
			message: "Listing repos requires local access to gh CLI.",
		};
	}
	try {
		const { stdout } = await exec(
			"gh",
			["api", `/orgs/${org}/repos`, "--paginate", "-q", ".[].full_name"],
			{ maxBuffer: 10 * 1024 * 1024 },
		);

		const repos = stdout.trim().split("\n").filter(Boolean);
		return {
			success: true,
			message: `Found ${repos.length} repos`,
			data: repos,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { success: false, message: `Failed to list repos: ${message}` };
	}
}

/**
 * Check `gh auth status` for both accounts.
 *
 * @returns The auth status output.
 */
export async function checkAuth(): Promise<ActionResult> {
	if (!isLocal()) {
		return {
			success: false,
			message: "Auth status requires local access to gh CLI.",
		};
	}
	try {
		const { stdout, stderr } = await exec("gh", ["auth", "status"], {
			env: { ...process.env },
		});
		return { success: true, message: stdout || stderr };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { success: false, message };
	}
}
