import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { loadConfig } from "@/src/core/config";
import { listOrgRepos } from "@/src/core/github";

/**
 * Register the `mirror_list_repos` tool on the given MCP server.
 *
 * @description Lists all repositories in the work org. Useful for discovering
 * repo names to add to `excludeRepos` in the config. Falls back to the
 * configured `workOrg` when no explicit org is provided.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerListReposTool(server: McpServer): void {
	server.registerTool(
		"mirror_list_repos",
		{
			title: "Mirror List Repos",
			description:
				"List all repos in the work org — useful for discovering what to exclude from mirroring",
			inputSchema: {
				org: z.string().optional(),
			},
		},
		async ({ org }) => {
			let targetOrg = org;

			if (!targetOrg) {
				try {
					const config = await loadConfig();
					targetOrg = config.workOrg;
				} catch {
					return {
						content: [
							{
								type: "text" as const,
								text: "No org provided and no config found. Run mirror_init first or pass an org name.",
							},
						],
					};
				}
			}

			const repos = await listOrgRepos(targetOrg);
			const lines = [
				`## Repositories in ${targetOrg} (${repos.length} total)`,
				"",
				...repos.map((r) => `- ${r}`),
			];

			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		},
	);
}
