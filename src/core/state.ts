import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LEGACY_STATE_DIR, STATE_FILE } from "@/src/lib/constants";
import { type State, stateSchema } from "@/src/lib/schema";

/**
 * Abstraction for loading and persisting {@link State}.
 * Allows the sync pipeline to be tested with an in-memory stub without
 * touching the filesystem — satisfying the Dependency Inversion principle.
 */
export interface StateStore {
	/**
	 * Load the current state.
	 *
	 * @returns A promise resolving to the current {@link State}.
	 */
	load(): Promise<State>;

	/**
	 * Persist updated state.
	 *
	 * @param state - The state object to save.
	 * @returns A promise that resolves when the write is complete.
	 */
	save(state: State): Promise<void>;
}

/** State value used when no persisted state file exists yet. */
const defaultState: State = {
	lastSyncedAt: null,
	totalCommitsMirrored: 0,
	mirrorRepoPath: "",
	mirroredShas: [],
};

/**
 * Check whether a file exists on disk.
 *
 * @param path - Absolute path to check.
 * @returns `true` if the file exists and is accessible.
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Migrate state from the legacy `~/Documents/other/mirror-commits/state.json`
 * path to the new XDG-compliant location. Only runs once — if the new file
 * already exists the migration is a no-op.
 *
 * @param newStateFile - Absolute path to the XDG state file.
 */
async function migrateFromLegacyPath(newStateFile: string): Promise<void> {
	if (await fileExists(newStateFile)) return;

	const legacyStateFile = join(LEGACY_STATE_DIR, "state.json");
	if (!(await fileExists(legacyStateFile))) return;

	await mkdir(dirname(newStateFile), { recursive: true });
	await copyFile(legacyStateFile, newStateFile);
}

/**
 * Reads and writes {@link State} to a JSON file on disk.
 *
 * @description Falls back to {@link defaultState} when the file does not
 * exist or cannot be parsed, making it safe to call before `mirror init`.
 * On first load, automatically migrates state from the legacy path if present.
 *
 * @example
 * ```ts
 * const store = new FileStateStore();
 * const state = await store.load();
 * state.lastSyncedAt = new Date().toISOString();
 * await store.save(state);
 * ```
 */
export class FileStateStore implements StateStore {
	private readonly stateFile: string;

	/**
	 * @param stateFile - Path to the state JSON file. Defaults to the
	 *   XDG-compliant path at `~/.local/share/mirror-commits/state.json`.
	 */
	constructor(stateFile: string = STATE_FILE) {
		this.stateFile = stateFile;
	}

	/** {@inheritDoc StateStore.load} */
	async load(): Promise<State> {
		try {
			if (this.stateFile === STATE_FILE) {
				await migrateFromLegacyPath(this.stateFile);
			}
			const raw = await readFile(this.stateFile, "utf-8");
			return stateSchema.parse(JSON.parse(raw));
		} catch {
			return { ...defaultState };
		}
	}

	/** {@inheritDoc StateStore.save} */
	async save(state: State): Promise<void> {
		await mkdir(dirname(this.stateFile), { recursive: true });
		await writeFile(this.stateFile, JSON.stringify(state, null, 2));
	}
}

/**
 * Convenience function that loads {@link State} from disk using
 * {@link FileStateStore}.
 *
 * @returns A promise resolving to the current persisted state, or the
 *   default state if none exists.
 */
export async function loadState(): Promise<State> {
	return new FileStateStore().load();
}

/**
 * Convenience function that persists {@link State} to disk using
 * {@link FileStateStore}.
 *
 * @param state - The state object to write.
 * @returns A promise that resolves when the write is complete.
 */
export async function saveState(state: State): Promise<void> {
	return new FileStateStore().save(state);
}
