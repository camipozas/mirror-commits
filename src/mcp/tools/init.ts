import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { init } from "@/src/core/init";

/**
 * Register the `mirror_init` tool on the given MCP server.
 *
 * @description Performs one-time mirror-commits setup: verifies `gh` auth for
 * both accounts, creates the personal mirror repository if it doesn't exist,
 * initialises the local git repo, and writes `mirror.config.json`.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerInitTool(server: McpServer): void {
	server.registerTool(
		"mirror_init",
		{
			title: "Mirror Init",
			description:
				"One-time setup: verify gh auth for both accounts, create mirror repo on personal GitHub",
			inputSchema: {
				workOrg: z.string().default("Euronet-RiaDigital-Product"),
				workEmails: z.string().default("cpozas@riamoneytransfer.com"),
				workGhUser: z.string().default("CPozas_euronet"),
				personalAccount: z.string().default("camipozas"),
				mirrorRepoName: z.string().default("work-mirror"),
			},
		},
		async ({
			workOrg,
			workEmails,
			workGhUser,
			personalAccount,
			mirrorRepoName,
		}) => {
			const result = await init({
				workOrg,
				workEmails: workEmails.split(",").map((e) => e.trim()),
				workGhUser,
				personalAccount,
				mirrorRepoName,
			});
			return { content: [{ type: "text" as const, text: result }] };
		},
	);
}
