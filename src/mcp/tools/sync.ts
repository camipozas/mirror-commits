import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { sync } from "@/src/core/sync";

/**
 * Register the `mirror_sync` tool on the given MCP server.
 *
 * @description Syncs work commits to the personal mirror repo. Fetches commits
 * from the work org, excludes configured repos, creates backdated empty commits,
 * and pushes to GitHub. Incremental by default using the stored cursor.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerSyncTool(server: McpServer): void {
	server.registerTool(
		"mirror_sync",
		{
			title: "Mirror Sync",
			description:
				"Sync work commits to personal mirror repo (incremental by default)",
			inputSchema: {
				full: z.boolean().default(false),
				dryRun: z.boolean().default(false),
				since: z.string().optional(),
			},
		},
		async ({ full, dryRun, since }) => {
			const result = await sync({ full, dryRun, since });
			const lines = [
				`Commits found: ${result.commitsFound}`,
				`Commits mirrored: ${result.commitsMirrored}`,
				`Dry run: ${result.dryRun}`,
				`Since: ${result.since ?? "beginning"}`,
			];
			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		},
	);
}
