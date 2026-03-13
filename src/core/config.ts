import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CONFIG_FILE } from "@/src/lib/constants";
import { type Config, configSchema } from "@/src/lib/schema";

/**
 * Abstraction for a configuration source.
 * Implementing this interface lets callers swap in alternative loaders
 * (e.g., environment variables, in-memory stubs for tests) without
 * changing the consumers — satisfying the Dependency Inversion principle.
 */
export interface ConfigLoader {
	/**
	 * Load and return a validated {@link Config}.
	 *
	 * @returns A promise that resolves to the validated configuration.
	 * @throws If the file cannot be read or its contents fail schema validation.
	 */
	load(): Promise<Config>;
}

/**
 * Loads {@link Config} from a JSON file on disk.
 *
 * @description Reads the config file, parses it as JSON, and validates it
 * against {@link configSchema}. This is the default {@link ConfigLoader}
 * used by the CLI and MCP server.
 *
 * @example
 * ```ts
 * const loader = new FileConfigLoader();
 * const config = await loader.load();
 * ```
 */
export class FileConfigLoader implements ConfigLoader {
	private readonly configPath: string;

	/**
	 * @param configPath - Path to the config JSON file. Defaults to
	 *   `mirror.config.json` in the current working directory.
	 */
	constructor(configPath?: string) {
		this.configPath = resolve(configPath ?? CONFIG_FILE);
	}

	/** {@inheritDoc ConfigLoader.load} */
	async load(): Promise<Config> {
		const raw = await readFile(this.configPath, "utf-8");
		const json = JSON.parse(raw);
		return configSchema.parse(json);
	}
}

/**
 * Convenience function that loads {@link Config} from disk using
 * {@link FileConfigLoader}.
 *
 * @param configPath - Optional path to override the default config file location.
 * @returns A promise resolving to the validated {@link Config}.
 * @throws If the file is missing, unreadable, or fails schema validation.
 *
 * @example
 * ```ts
 * const config = await loadConfig();
 * const config = await loadConfig("/custom/path/mirror.config.json");
 * ```
 */
export async function loadConfig(configPath?: string): Promise<Config> {
	return new FileConfigLoader(configPath).load();
}
