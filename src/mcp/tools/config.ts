import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { CONFIG_FILE } from "@/src/lib/constants";
import { loadConfig } from "@/src/core/config";

/**
 * Register the `mirror_config` tool on the given MCP server.
 *
 * @description View or update the current mirror configuration. When called
 * with no arguments, returns the current config as formatted JSON. When
 * `excludeRepos` is provided, replaces the exclusion list and writes the
 * updated config back to disk.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerConfigTool(server: McpServer): void {
	server.registerTool(
		"mirror_config",
		{
			title: "Mirror Config",
			description:
				"Show or update the current mirror config. Pass excludeRepos to update the exclusion list.",
			inputSchema: {
				excludeRepos: z.array(z.string()).optional(),
			},
		},
		async ({ excludeRepos }) => {
			let config;
			try {
				config = await loadConfig();
			} catch {
				return {
					content: [
						{
							type: "text" as const,
							text: "No config found. Run mirror_init first.",
						},
					],
				};
			}

			if (excludeRepos !== undefined) {
				const updated = { ...config, excludeRepos };
				const configPath = resolve(CONFIG_FILE);
				await writeFile(configPath, JSON.stringify(updated, null, 2));

				return {
					content: [
						{
							type: "text" as const,
							text: `Config updated. excludeRepos is now:\n${excludeRepos.map((r) => `- ${r}`).join("\n") || "(empty)"}`,
						},
					],
				};
			}

			const lines = [
				"## Current Config",
				"",
				`\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``,
			];

			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		},
	);
}
