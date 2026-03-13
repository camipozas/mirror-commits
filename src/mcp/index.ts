#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerConfigTool } from "@/src/mcp/tools/config";
import { registerInitTool } from "@/src/mcp/tools/init";
import { registerListReposTool } from "@/src/mcp/tools/list-repos";
import { registerLogTool } from "@/src/mcp/tools/log";
import { registerScheduleTool } from "@/src/mcp/tools/schedule";
import { registerStatusTool } from "@/src/mcp/tools/status";
import { registerSyncTool } from "@/src/mcp/tools/sync";

/**
 * MCP server for mirror-commits.
 *
 * @description Exposes all mirror-commits operations as MCP tools so that
 * Claude (or any MCP client) can drive the tool conversationally. Each tool
 * lives in its own file under `tools/` (Single Responsibility) and is
 * registered here during server bootstrap.
 */
const server = new McpServer({
	name: "mirror-commits",
	version: "1.0.0",
});

registerInitTool(server);
registerSyncTool(server);
registerStatusTool(server);
registerScheduleTool(server);
registerListReposTool(server);
registerConfigTool(server);
registerLogTool(server);

/**
 * Connect the MCP server to stdio and start listening for tool calls.
 *
 * @returns A promise that resolves when the server is connected and ready.
 */
async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
