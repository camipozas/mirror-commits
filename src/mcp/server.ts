import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MirrorDeps } from '@/src/mcp/deps';
import { registerConfigTool } from '@/src/mcp/tools/config';
import { registerInitTool } from '@/src/mcp/tools/init';
import { registerListReposTool } from '@/src/mcp/tools/list-repos';
import { registerLogTool } from '@/src/mcp/tools/log';
import { registerRepairTool } from '@/src/mcp/tools/repair';
import { registerScheduleTool } from '@/src/mcp/tools/schedule';
import { registerStatusTool } from '@/src/mcp/tools/status';
import { registerSyncTool } from '@/src/mcp/tools/sync';

/**
 * Create and configure an MCP server with all mirror-commits tools.
 *
 * In remote mode, filesystem-only tools (log, schedule) are omitted.
 *
 * @param deps - Injected dependencies (local or remote implementations).
 * @returns A fully configured {@link McpServer}.
 */
export function createMcpServer(deps: MirrorDeps): McpServer {
  const server = new McpServer({
    name: 'mirror-commits',
    version: '1.0.0',
  });

  registerInitTool(server, deps);
  registerSyncTool(server, deps);
  registerStatusTool(server, deps);
  registerListReposTool(server, deps);
  registerConfigTool(server, deps);
  registerRepairTool(server, deps);

  if (!deps.remote) {
    registerLogTool(server);
    registerScheduleTool(server);
  }

  return server;
}
