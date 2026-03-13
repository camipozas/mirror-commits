import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildRemoteDeps } from "@/src/mcp/deps";
import { createMcpServer } from "@/src/mcp/server";

/**
 * Extract tokens and config from request headers, build remote deps,
 * create a stateless MCP server, and handle the request.
 */
async function handleMcpRequest(req: Request): Promise<Response> {
	const workToken = req.headers.get("x-github-work-token");
	const personalToken = req.headers.get("x-github-personal-token");
	const rawConfigHeader = req.headers.get("x-config");

	if (!workToken || !personalToken) {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32600,
					message:
						"Missing required headers: X-GitHub-Work-Token and X-GitHub-Personal-Token",
				},
				id: null,
			}),
			{ status: 401, headers: { "content-type": "application/json" } },
		);
	}

	if (!rawConfigHeader) {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32600,
					message:
						"Missing required header: X-Config (JSON with workOrg, workEmails, etc.)",
				},
				id: null,
			}),
			{ status: 400, headers: { "content-type": "application/json" } },
		);
	}

	let parsedConfig: unknown;
	try {
		parsedConfig = JSON.parse(rawConfigHeader);
	} catch {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: { code: -32600, message: "X-Config header is not valid JSON" },
				id: null,
			}),
			{ status: 400, headers: { "content-type": "application/json" } },
		);
	}

	let deps: ReturnType<typeof buildRemoteDeps>;
	try {
		deps = buildRemoteDeps(workToken, personalToken, parsedConfig);
	} catch (err) {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32600,
					message: `Invalid config: ${err instanceof Error ? err.message : String(err)}`,
				},
				id: null,
			}),
			{ status: 400, headers: { "content-type": "application/json" } },
		);
	}

	const server = createMcpServer(deps);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});

	await server.connect(transport);

	return transport.handleRequest(req);
}

export async function GET(req: Request): Promise<Response> {
	return handleMcpRequest(req);
}

export async function POST(req: Request): Promise<Response> {
	return handleMcpRequest(req);
}

export async function DELETE(req: Request): Promise<Response> {
	return handleMcpRequest(req);
}
