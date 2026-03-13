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
				workOrg: z.string().default(""),
				workEmails: z.string().default(""),
				workGhUser: z.string().default(""),
				personalAccount: z.string().default(""),
				mirrorRepoName: z.string().default("work-mirror"),
				personalEmail: z.string().default(""),
			},
		},
		async ({
			workOrg,
			workEmails,
			workGhUser,
			personalAccount,
			mirrorRepoName,
			personalEmail,
		}) => {
			const result = await init({
				workOrg,
				workEmails: workEmails.split(",").map((e) => e.trim()),
				workGhUser,
				personalAccount,
				mirrorRepoName,
				personalEmail,
			});
			return { content: [{ type: "text" as const, text: result }] };
		},
	);
}
