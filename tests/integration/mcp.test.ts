/**
 * MCP (docs/08 §2, docs/11 §2): connect with the SDK client to the running dev server, list tools
 * (only public, read-only ones) and call each with valid and invalid input. Skipped when
 * http://localhost:3000 is not reachable (CI runs the handler-level SSE and tool tests instead).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { publicTools } from "@/lib/tools/registry";

const BASE = process.env.MCP_TEST_URL ?? "http://localhost:3000/api/mcp";

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { method: "OPTIONS", signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}
const up = await reachable();

const VALID: Record<string, Record<string, unknown>> = {
  list_portfolio: { vertical: "Maritime" },
  portfolio_stats: {},
  get_company: { slug: "vessev" },
  get_diagnostic: { slug: "desolenator" },
  get_benchmarks: { domain: "operations" },
  search_playbook: { query: "pilot" },
  get_lesson: { id: "wsense-strategic" },
  get_growth_engine: {},
  list_pipeline: {},
  get_market_evidence: { slug: "desolenator", weights: { water: 80, solar: 50, presence: 50 } },
  get_impact: {},
  get_strategic_paths: { slug: "desolenator" },
};
const INVALID: Record<string, Record<string, unknown>> = {
  list_portfolio: { vertical: "Space" },
  portfolio_stats: { unexpected: "x" },
  get_company: { slug: "" },
  get_diagnostic: { slug: 42 },
  get_benchmarks: { domain: "vibes" },
  search_playbook: { query: "x".repeat(500) },
  get_lesson: {},
  get_growth_engine: { unexpected: 1 },
  list_pipeline: { unexpected: 1 },
  get_market_evidence: { slug: "desolenator", weights: { water: 900, solar: 0, presence: 0 } },
  get_impact: { unexpected: 1 },
  get_strategic_paths: { slug: "" },
};

describe.skipIf(!up)("MCP server over Streamable HTTP", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ name: "rypples-mcp-test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(BASE)));
  });
  afterAll(async () => {
    await client?.close();
  });

  it("lists only the public, read-only tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(publicTools().map((t) => t.name).sort());
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(t.description?.length, t.name).toBeGreaterThan(20);
    }
    expect(tools.map((t) => t.name)).not.toContain("propose_next_step");
    expect(tools.map((t) => t.name)).not.toContain("get_ledger");
  });

  it("has a valid and an invalid sample for every listed tool", async () => {
    const { tools } = await client.listTools();
    for (const t of tools) {
      expect(VALID[t.name], t.name).toBeDefined();
      expect(INVALID[t.name], t.name).toBeDefined();
    }
  });

  it.each(Object.keys(VALID))("%s answers valid input with text and records", async (name) => {
    const res = (await client.callTool({ name, arguments: VALID[name] })) as { isError?: boolean; content: { type: string; text?: string }[]; structuredContent?: unknown };
    expect(res.isError, JSON.stringify(res.content).slice(0, 300)).toBeFalsy();
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    expect(text.length).toBeGreaterThan(10);
    expect(text).toContain("http");
  });

  /** isError result, or a JSON-RPC error thrown by the SDK; both count as a rejection. */
  async function rejected(name: string, args: Record<string, unknown>): Promise<boolean> {
    try {
      const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean };
      return res.isError === true;
    } catch {
      return true;
    }
  }

  it.each(Object.keys(INVALID))("%s rejects invalid input", async (name) => {
    expect(await rejected(name, INVALID[name]!)).toBe(true);
  });

  it("refuses an unannounced company and a tool that is not public", async () => {
    expect(await rejected("get_company", { slug: "unannounced" })).toBe(true);
    expect(await rejected("propose_next_step", { title: "x", detail: "y", target: null })).toBe(true);
    expect(await rejected("get_ledger", { slug: "desolenator" })).toBe(true);
  });
});
