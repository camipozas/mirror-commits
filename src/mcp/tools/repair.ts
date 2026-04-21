import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { RepairRunner } from '@/src/core/repair';
import type { MirrorDeps } from '@/src/mcp/deps';

/**
 * Register the `mirror_repair` tool on the given MCP server.
 *
 * @param server - The MCP server instance to register the tool on.
 * @param deps - Injected dependencies (local or remote implementations).
 */
export function registerRepairTool(server: McpServer, deps: MirrorDeps): void {
  server.registerTool(
    'mirror_repair',
    {
      title: 'Mirror Repair',
      description:
        'Self-heal the mirror repo: discard orphan local commits left behind by failed pushes, run `git fsck`, and re-clone from origin when the object store is corrupt. Use `force: true` to re-clone unconditionally. No-op in remote mode beyond reporting.',
      inputSchema: {
        force: z.boolean().default(false),
      },
    },
    async ({ force }) => {
      const runner = new RepairRunner({
        configLoader: deps.configLoader,
        stateStore: deps.stateStore,
        gitOps: deps.gitOps,
      });

      const result = await runner.run({ force });

      const lines = [
        '## Mirror Repair',
        '',
        `fsck: ${result.fsckOk ? 'ok' : 'errors'}`,
        `Discarded orphan commits: ${result.discardedAhead}`,
        `Re-cloned: ${result.recloned ? 'yes' : 'no'}`,
      ];
      if (!result.fsckOk && result.fsckErrors.length > 0) {
        lines.push(
          '',
          '### fsck errors',
          ...result.fsckErrors.map((e) => `  ${e}`)
        );
      }
      if (result.remoteUrl) {
        lines.push('', `Remote: ${result.remoteUrl}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );
}
