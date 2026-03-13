import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { CONFIG_FILE } from "@/src/lib/constants";
import type { Config } from "@/src/lib/schema";
import type { MirrorDeps } from "@/src/mcp/deps";

/**
 * Register the `mirror_config` tool on the given MCP server.
 *
 * @description View or update the current mirror configuration. In remote
 * mode config is read-only (sourced from headers). In local mode,
 * `excludeRepos` updates are written back to disk.
 *
 * @param server - The MCP server instance to register the tool on.
 * @param deps - Injected dependencies (local or remote implementations).
 */
export function registerConfigTool(server: McpServer, deps: MirrorDeps): void {
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
			let config: Config;
			try {
				config = await deps.configLoader.load();
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
				if (deps.remote) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Config updates are not supported in remote mode. Update the X-Config header in your MCP client config instead.",
							},
						],
					};
				}

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
