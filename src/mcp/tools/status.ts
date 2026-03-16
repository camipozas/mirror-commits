import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MirrorDeps } from "@/src/mcp/deps";

/**
 * Format a duration between two dates into a human-readable string.
 *
 * @param from - ISO date string of the earlier date.
 * @returns A relative time string like "2h ago" or "3d ago".
 */
function timeSince(from: string): string {
	const ms = Date.now() - new Date(from).getTime();
	const mins = Math.floor(ms / 60_000);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

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
			description:
				"Show mirror status: last sync time, total mirrored commits, config summary, and schedule status. Does not require any arguments.",
			inputSchema: {},
		},
		async () => {
			const state = await deps.stateStore.load();

			const lastSyncDisplay = state.lastSyncedAt
				? `${state.lastSyncedAt} (${timeSince(state.lastSyncedAt)})`
				: "never";

			const lines = [
				"## Mirror Status",
				"",
				`Last synced: ${lastSyncDisplay}`,
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
					`Work emails: ${config.workEmails.join(", ")}`,
					`Excluded: ${config.excludeRepos?.join(", ") || "none"}`,
				);
			} catch {
				lines.push("", "No config found. Run `mirror_init` first.");
			}

			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		},
	);
}
