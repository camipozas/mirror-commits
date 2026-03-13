import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import {
	installSchedule,
	removeSchedule,
	scheduleStatus,
} from "@/src/core/launchd";

/**
 * Register the `mirror_schedule` tool on the given MCP server.
 *
 * @description Manages the macOS launchd daily sync schedule (local-only).
 * Supports three actions: `install` (write plist and load agent), `remove`
 * (unload and delete), and `status` (check whether the schedule is active).
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerScheduleTool(server: McpServer): void {
	server.registerTool(
		"mirror_schedule",
		{
			title: "Mirror Schedule",
			description:
				"Install, remove, or check status of daily launchd sync schedule",
			inputSchema: {
				action: z.enum(["install", "remove", "status"]),
				hour: z.number().min(0).max(23).default(22),
			},
		},
		async ({ action, hour }) => {
			const projectDir = resolve(import.meta.dirname, "../../..");
			let result: string;
			switch (action) {
				case "install":
					result = await installSchedule(hour, projectDir);
					break;
				case "remove":
					result = await removeSchedule();
					break;
				case "status":
					result = await scheduleStatus();
					break;
			}
			return { content: [{ type: "text" as const, text: result }] };
		},
	);
}
