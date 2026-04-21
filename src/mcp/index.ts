#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildLocalDeps } from '@/src/mcp/deps';
import { createMcpServer } from '@/src/mcp/server';

/**
 * MCP server for mirror-commits (local stdio mode).
 *
 * Builds local dependencies (gh CLI / filesystem) and connects over stdio.
 */
async function main(): Promise<void> {
  const deps = buildLocalDeps();
  const server = createMcpServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
