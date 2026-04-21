import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import type { MirrorDeps } from '@/src/mcp/deps';

/**
 * Register the `mirror_list_repos` tool on the given MCP server.
 *
 * @param server - The MCP server instance to register the tool on.
 * @param deps - Injected dependencies (local or remote implementations).
 */
export function registerListReposTool(
  server: McpServer,
  deps: MirrorDeps
): void {
  server.registerTool(
    'mirror_list_repos',
    {
      title: 'Mirror List Repos',
      description:
        'List all repos in the work org — useful for discovering what to add to `excludeRepos`. Uses the org from config if not provided. Requires `mirror_init` to be run first (or pass `org` explicitly).',
      inputSchema: {
        org: z.string().optional(),
      },
    },
    async ({ org }) => {
      let targetOrg = org;

      if (!targetOrg) {
        try {
          const config = await deps.configLoader.load();
          targetOrg = config.workOrg;
        } catch {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No org provided and no config found. Run mirror_init first or pass an org name.',
              },
            ],
          };
        }
      }

      const repos = await deps.commitSource.listOrgRepos(targetOrg);
      const lines = [
        `## Repositories in ${targetOrg} (${repos.length} total)`,
        '',
        ...repos.map((r) => `- ${r}`),
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );
}
