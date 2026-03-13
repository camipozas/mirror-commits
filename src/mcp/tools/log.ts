import { readFile } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { LOG_FILE } from "@/src/lib/constants";

/**
 * Register the `mirror_log` tool on the given MCP server.
 *
 * @description Shows recent sync log entries. Reads the last N lines of the
 * log file written by the launchd agent and manual sync runs.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerLogTool(server: McpServer): void {
	server.registerTool(
		"mirror_log",
		{
			title: "Mirror Log",
			description: "Show recent sync log entries from the mirror log file",
			inputSchema: {
				lines: z.number().min(1).max(500).default(50),
			},
		},
		async ({ lines }) => {
			let content: string;
			try {
				const raw = await readFile(LOG_FILE, "utf-8");
				const allLines = raw.split("\n");
				const tail = allLines.slice(-lines).join("\n");
				content = tail.trim() || "(log is empty)";
			} catch {
				content = `Log file not found at ${LOG_FILE}. Run a sync first.`;
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `## Mirror Log (last ${lines} lines)\n\n${content}`,
					},
				],
			};
		},
	);
}
