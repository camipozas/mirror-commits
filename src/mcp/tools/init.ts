import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { InitRunner } from "@/src/core/init";
import { SyncRunner } from "@/src/core/sync";
import type { MirrorDeps } from "@/src/mcp/deps";

/**
 * Register the `mirror_init` tool on the given MCP server.
 *
 * @param server - The MCP server instance to register the tool on.
 * @param deps - Injected dependencies (local or remote implementations).
 */
export function registerInitTool(server: McpServer, deps: MirrorDeps): void {
	server.registerTool(
		"mirror_init",
		{
			title: "Mirror Init",
			description:
				"One-time setup: verify auth, create a private mirror repo on personal GitHub, and run initial sync. Works both locally (gh CLI) and remotely (GitHub API via tokens).",
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
			const runner = new InitRunner({
				gitOps: deps.gitOps,
				accountManager: deps.accountManager,
				repoManager: deps.repoManager,
				stateStore: deps.stateStore,
				remote: deps.remote,
				syncFn: (opts) =>
					new SyncRunner({
						configLoader: deps.configLoader,
						stateStore: deps.stateStore,
						commitSource: deps.commitSource,
						accountManager: deps.accountManager,
						gitOps: deps.gitOps,
					}).run(opts),
			});

			const result = await runner.run({
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
