import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "@/src/core/config";
import { loadState } from "@/src/core/state";

/**
 * Register the `mirror_status` tool on the given MCP server.
 *
 * @description Returns the last sync time, total mirrored commit count,
 * mirror repo path, and all config values from `mirror.config.json`.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerStatusTool(server: McpServer): void {
	server.registerTool(
		"mirror_status",
		{
			title: "Mirror Status",
			description: "Show last sync time, total mirrored commits, and config",
			inputSchema: {},
		},
		async () => {
			const state = await loadState();
			const lines = [
				"## Mirror Status",
				`Last synced: ${state.lastSyncedAt ?? "never"}`,
				`Total mirrored: ${state.totalCommitsMirrored}`,
				`Mirror repo: ${state.mirrorRepoPath || "not set"}`,
			];

			try {
				const config = await loadConfig();
				lines.push(
					"",
					"## Config",
					`Work org: ${config.workOrg}`,
					`Work user: ${config.workGhUser}`,
					`Personal: ${config.personalAccount}`,
					`Mirror repo: ${config.mirrorRepoName}`,
					`Excluded: ${config.excludeRepos?.join(", ") || "none"}`,
				);
			} catch {
				lines.push("", "No config found. Run mirror_init first.");
			}

			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		},
	);
}
