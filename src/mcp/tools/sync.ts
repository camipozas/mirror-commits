import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { SyncRunner } from "@/src/core/sync";
import type { MirrorDeps } from "@/src/mcp/deps";

/**
 * Register the `mirror_sync` tool on the given MCP server.
 *
 * @param server - The MCP server instance to register the tool on.
 * @param deps - Injected dependencies (local or remote implementations).
 */
export function registerSyncTool(server: McpServer, deps: MirrorDeps): void {
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
			const runner = new SyncRunner({
				configLoader: deps.configLoader,
				stateStore: deps.stateStore,
				commitSource: deps.commitSource,
				accountManager: deps.accountManager,
				gitOps: deps.gitOps,
			});

			const result = await runner.run({ full, dryRun, since });
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
