import { execFile } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { LAUNCHD_LABEL, LAUNCHD_PLIST, LOG_FILE } from "@/src/lib/constants";

const exec = promisify(execFile);

/**
 * Build the launchd plist XML that runs `mirror sync` on a daily schedule.
 *
 * @param hour - Hour of the day (0–23) at which the agent should fire.
 * @param projectDir - Absolute path to the mirror-commits project directory,
 *   used in the `ProgramArguments` array.
 * @returns A valid macOS launchd plist XML string.
 */
function generatePlist(hour: number, projectDir: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${LAUNCHD_LABEL}</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/zsh</string>
		<string>-c</string>
		<string>cd ${projectDir} &amp;&amp; npx tsx src/cli/index.ts sync</string>
	</array>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>${hour}</integer>
		<key>Minute</key>
		<integer>0</integer>
	</dict>
	<key>StandardOutPath</key>
	<string>${LOG_FILE}</string>
	<key>StandardErrorPath</key>
	<string>${LOG_FILE}</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
	</dict>
</dict>
</plist>`;
}

/**
 * Install (or reinstall) the daily launchd sync schedule.
 *
 * @description Writes the generated plist to `~/Library/LaunchAgents/`,
 * unloads any existing instance, and loads the new one so it takes effect
 * immediately without requiring a logout.
 *
 * @param hour - Hour of the day (0–23) at which the agent should fire.
 * @param projectDir - Absolute path to the mirror-commits project root.
 * @returns A human-readable summary of what was installed and when it will run.
 * @throws If `launchctl load` fails.
 *
 * @example
 * ```ts
 * const msg = await installSchedule(22, "/Users/me/projects/mirror-commits");
 * console.log(msg); // "Installed launchd plist at .... Runs daily at 22:00."
 * ```
 */
export async function installSchedule(
	hour: number,
	projectDir: string,
): Promise<string> {
	const plist = generatePlist(hour, projectDir);
	await writeFile(LAUNCHD_PLIST, plist);

	try {
		await exec("launchctl", ["unload", LAUNCHD_PLIST]);
	} catch {
		// Not loaded yet — expected on first install
	}
	await exec("launchctl", ["load", LAUNCHD_PLIST]);

	return `Installed launchd plist at ${LAUNCHD_PLIST}. Runs daily at ${hour}:00.`;
}

/**
 * Remove the launchd sync schedule and delete the plist file.
 *
 * @description Attempts to unload the agent before deleting the plist.
 * Both steps are best-effort — errors are silently swallowed so the
 * function is idempotent.
 *
 * @returns A confirmation message.
 *
 * @example
 * ```ts
 * const msg = await removeSchedule();
 * console.log(msg); // "Removed launchd schedule."
 * ```
 */
export async function removeSchedule(): Promise<string> {
	try {
		await exec("launchctl", ["unload", LAUNCHD_PLIST]);
	} catch {
		// Not currently loaded
	}
	try {
		await unlink(LAUNCHD_PLIST);
	} catch {
		// File does not exist
	}
	return "Removed launchd schedule.";
}

/**
 * Return a human-readable description of the current schedule status.
 *
 * @description Reads the plist file to find the configured hour, then
 * queries `launchctl list` to determine whether the agent is currently loaded.
 *
 * @returns A status string. Possible values:
 *   - `"No schedule installed."` — plist file does not exist.
 *   - `"Plist exists (HH:00) but not loaded. Run install to activate."` — plist
 *     exists but the agent is not running.
 *   - `"Schedule active. Runs daily at HH:00.\n<launchctl output>"` — agent
 *     is loaded and running.
 *
 * @example
 * ```ts
 * const status = await scheduleStatus();
 * console.log(status);
 * ```
 */
export async function scheduleStatus(): Promise<string> {
	try {
		const content = await readFile(LAUNCHD_PLIST, "utf-8");
		const hourMatch = content.match(
			/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/,
		);
		const hour = hourMatch ? hourMatch[1] : "unknown";

		try {
			const { stdout } = await exec("launchctl", ["list", LAUNCHD_LABEL]);
			return `Schedule active. Runs daily at ${hour}:00.\n${stdout}`;
		} catch {
			return `Plist exists (${hour}:00) but not loaded. Run install to activate.`;
		}
	} catch {
		return "No schedule installed.";
	}
}
