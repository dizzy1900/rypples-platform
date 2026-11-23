/**
 * Public read-only MCP server over the tool registry (docs/08-mcp-and-integrations.md §3).
 * Stateless Streamable HTTP: a fresh server and transport per request, no session ids.
 * PublicViewer only: seed data, never session overlays or Captain messages.
 */
import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { PUBLIC_VIEWER } from "@/lib/viewer";
import { publicTools } from "@/lib/tools/registry";
import type { ToolResult } from "@/lib/tools/types";

export const MCP_INSTRUCTIONS =
  "Read-only access to the Rypples Platform prototype's demo data: the public ocean portfolio, scenario and illustrative figures (flagged by `provenance`). Caveat outside benchmarks and low-confidence values.";

const MAX_TEXT = 6000;

/** Concise text for clients that ignore structured content. */
export function renderText(title: string, r: ToolResult<unknown>): string {
  const body = JSON.stringify(r.data, null, 1);
  const links = r.refs
    .map((x) => x.href ?? x.url)
    .filter(Boolean)
    .slice(0, 12);
  const clipped = body.length > MAX_TEXT ? `${body.slice(0, MAX_TEXT)}\n… (truncated; see structuredContent)` : body;
  return `${title}\n${clipped}${links.length ? `\n\nLinks:\n${links.join("\n")}` : ""}`;
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "rypples", title: "Rypples Platform (demo)", version: "0.1.0" }, { instructions: MCP_INSTRUCTIONS, capabilities: { tools: {} } });
  for (const t of publicTools()) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.input as never,
        annotations: { title: t.title, readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      },
      (async (args: unknown) => {
        try {
          const r = await t.handler({ viewer: PUBLIC_VIEWER, sessionId: null }, (args ?? {}) as never);
          return { content: [{ type: "text" as const, text: renderText(t.title, r) }], structuredContent: { data: r.data, refs: r.refs } };
        } catch (err) {
          return { isError: true, content: [{ type: "text" as const, text: (err as Error).message || "Tool failed" }] };
        }
      }) as never,
    );
  }
  return server;
}

export async function handleMcp(req: Request, parsedBody: unknown): Promise<Response> {
  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req, { parsedBody });
  } finally {
    // stateless: nothing to keep between requests
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  }
}
