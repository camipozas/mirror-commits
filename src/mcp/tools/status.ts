import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MirrorDeps } from "@/src/mcp/deps";

/**
 * Register the `mirror_status` tool on the given MCP server.
 *
 * @param server - The MCP server instance to register the tool on.
 * @param deps - Injected dependencies (local or remote implementations).
 */
export function registerStatusTool(server: McpServer, deps: MirrorDeps): void {
	server.registerTool(
		"mirror_status",
		{
			title: "Mirror Status",
			description: "Show last sync time, total mirrored commits, and config",
			inputSchema: {},
		},
		async () => {
			const state = await deps.stateStore.load();
			const lines = [
				"## Mirror Status",
				`Last synced: ${state.lastSyncedAt ?? "never"}`,
				`Total mirrored: ${state.totalCommitsMirrored}`,
				`Mirror repo: ${state.mirrorRepoPath || "not set"}`,
			];

			try {
				const config = await deps.configLoader.load();
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
