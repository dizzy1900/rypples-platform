/**
 * Public read-only MCP endpoint (docs/08-mcp-and-integrations.md §3, docs/10 §3 and §5):
 * stateless Streamable HTTP, CORS for any origin without credentials, 64 KB body cap,
 * 120 requests per minute per IP.
 */
import { checkLimit, clientIp, hashIp } from "@/lib/ai/ratelimit";
import { handleMcp } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY = 64 * 1024;
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

function withCors(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const rpcError = (status: number, code: number, message: string, id: unknown = null) =>
  withCors(new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id }), { status, headers: { "content-type": "application/json" } }));

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  // Stateless server: no standalone SSE stream.
  return withCors(new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Use POST." }, id: null }), { status: 405, headers: { allow: "POST, OPTIONS", "content-type": "application/json" } }));
}

export async function POST(req: Request) {
  const limit = await checkLimit("mcp", hashIp(clientIp(req)));
  if (!limit.ok) return rpcError(429, -32000, "Rate limit: 120 requests per minute. Try again shortly.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return rpcError(413, -32600, "Request body over 64 KB");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY) return rpcError(413, -32600, "Request body over 64 KB");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rpcError(400, -32700, "Parse error");
  }
  const forwarded = new Request(req.url, { method: "POST", headers: req.headers, body: text });
  return withCors(await handleMcp(forwarded, body));
}
