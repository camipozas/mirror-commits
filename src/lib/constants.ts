import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Root directory for all mirror-commits runtime state files.
 * Located at `~/Documents/other/mirror-commits` so that the git conditional
 * include (`[includeIf "gitdir:~/Documents/other/"]`) automatically sets the
 * personal email on the nested `work-mirror` repository.
 */
export const STATE_DIR = join(
	homedir(),
	"Documents",
	"other",
	"mirror-commits",
);

/**
 * Absolute path to the JSON file that persists sync state between runs.
 */
export const STATE_FILE = join(STATE_DIR, "state.json");

/**
 * Absolute path to the log file used by the launchd agent and manual syncs.
 */
export const LOG_FILE = join(STATE_DIR, "mirror.log");

/**
 * Default filename for the project-level configuration file.
 * Resolved relative to the current working directory unless overridden.
 */
export const CONFIG_FILE = "mirror.config.json";

/**
 * Default commit message prefix written into every mirrored empty commit.
 */
export const DEFAULT_COMMIT_MSG = "chore: add mirror";

/**
 * Reverse-DNS label used to identify the launchd agent on macOS.
 */
export const LAUNCHD_LABEL = "com.mirror-commits";

/**
 * Absolute path to the launchd plist file installed in `~/Library/LaunchAgents`.
 */
export const LAUNCHD_PLIST = join(
	homedir(),
	"Library",
	"LaunchAgents",
	`${LAUNCHD_LABEL}.plist`,
);
