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
				"Sync work commits to personal mirror repo. Requires `mirror_init` to be run first. Incremental by default (syncs since last run). Use `full: true` for a complete re-sync, `since` to override the start date, or `until` to cap the upper bound (useful when chunking a large range).",
			inputSchema: {
				full: z.boolean().default(false),
				dryRun: z.boolean().default(false),
				since: z.string().optional(),
				until: z.string().optional(),
			},
		},
		async ({ full, dryRun, since, until }) => {
			const runner = new SyncRunner({
				configLoader: deps.configLoader,
				stateStore: deps.stateStore,
				commitSource: deps.commitSource,
				accountManager: deps.accountManager,
				gitOps: deps.gitOps,
			});

			const result = await runner.run({ full, dryRun, since, until });

			const repoLines = result.repoBreakdown.map(
				(r) => `  ${r.repo}: ${r.count} commits`,
			);

			const lines = [
				`## Sync ${result.dryRun ? "(Dry Run)" : "Complete"}`,
				"",
				`Commits found: ${result.commitsFound}`,
				`Commits mirrored: ${result.commitsMirrored}`,
				`Since: ${result.since ?? "beginning"}`,
				`Total mirrored: ${result.totalMirrored}`,
			];

			if (repoLines.length > 0) {
				lines.push("", "### Per-repo breakdown", ...repoLines);
			}

			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		},
	);
}
