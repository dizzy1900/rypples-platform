import { describe, expect, it } from "vitest";
import { TOOLS, publicTools, runTool, toAnthropicTools, toolsFor } from "@/lib/tools/registry";
import { JEROME, PUBLIC_VIEWER, ScopeError, founderViewer } from "@/lib/viewer";
import { appendEvent, getSeedState, getState } from "@/lib/data";
import { buildDayOne } from "@/lib/ai/flows/day-one";
import { DayOnePlan } from "@/lib/ai/schemas/day-one";
import { precomputed } from "@/lib/ai/precomputed";
import { RefSchema } from "@/lib/ai/sse";

const VALID: Record<string, Record<string, unknown>> = {
  list_portfolio: {},
  portfolio_stats: {},
  get_company: { slug: "desolenator" },
  get_diagnostic: { slug: "desolenator" },
  get_benchmarks: {},
  search_playbook: {},
  get_lesson: { id: "wsense-strategic" },
  get_growth_engine: {},
  get_allocation: { slug: "desolenator" },
  get_ledger: { slug: "desolenator" },
  list_pipeline: {},
  get_market_evidence: { slug: "desolenator" },
  get_impact: {},
  get_strategic_paths: { slug: "desolenator" },
  list_decisions: {},
  get_board_pack_status: { slug: "desolenator" },
  propose_next_step: { title: "Book the Finance Sprint intro", detail: "Ahead of Thursday's board.", target: null },
};
const ADRI = founderViewer("desolenator", "adri");
const sid = () => `test-tools-${Math.random().toString(36).slice(2)}`;

describe("tool registry (docs/08 §1, docs/11 §2)", () => {
  it("has a valid sample input for every tool", () => {
    expect(Object.keys(VALID).sort()).toEqual(TOOLS.map((t) => t.name).sort());
  });

  it.each(TOOLS.map((t) => t.name))("%s returns valid refs for Rypples", async (name) => {
    const r = await runTool(name, { viewer: JEROME, sessionId: sid() }, VALID[name]);
    expect(r.refs.length).toBeGreaterThan(0);
    for (const ref of r.refs) expect(RefSchema.safeParse(ref).success, JSON.stringify(ref)).toBe(true);
  });

  const slugTools = TOOLS.filter((t) => "slug" in (VALID[t.name] ?? {}));
  it.each(slugTools.map((t) => t.name))("%s: a founder gets a ScopeError on a foreign slug", async (name) => {
    await expect(runTool(name, { viewer: ADRI, sessionId: sid() }, { ...VALID[name], slug: "vessev" })).rejects.toBeInstanceOf(ScopeError);
  });

  it("founder-scoped slug tools work on the founder's own company", async () => {
    for (const t of slugTools.filter((x) => x.scopes.includes("founder"))) {
      const r = await runTool(t.name, { viewer: ADRI, sessionId: sid() }, VALID[t.name]);
      expect(r.refs.length, t.name).toBeGreaterThan(0);
    }
  });

  it("tools outside the founder scope refuse a founder", async () => {
    for (const t of TOOLS.filter((x) => !x.scopes.includes("founder"))) {
      await expect(runTool(t.name, { viewer: ADRI, sessionId: sid() }, VALID[t.name]), t.name).rejects.toBeInstanceOf(ScopeError);
    }
  });

  it("a founder cannot read a lesson that was not sent to them", async () => {
    await expect(runTool("get_lesson", { viewer: ADRI, sessionId: sid() }, { id: "conversion-terms" })).rejects.toBeInstanceOf(ScopeError);
  });

  it("only exposes public, read-only tools to the public viewer and MCP", () => {
    const pub = publicTools();
    expect(pub.length).toBeGreaterThan(5);
    for (const t of pub) expect(t.readOnly && t.scopes.includes("public")).toBe(true);
    expect(pub.map((t) => t.name)).not.toContain("propose_next_step");
    expect(toolsFor(PUBLIC_VIEWER).map((t) => t.name).sort()).toEqual(pub.map((t) => t.name).sort());
    expect(toAnthropicTools(ADRI).map((t) => t.name)).not.toContain("list_portfolio");
  });

  it("rejects invalid input", async () => {
    await expect(runTool("get_company", { viewer: JEROME }, { slug: "" })).rejects.toThrow(/Invalid input/);
    await expect(runTool("get_benchmarks", { viewer: JEROME }, { domain: "vibes" })).rejects.toThrow(/Invalid input/);
  });

  it("the public viewer never sees session rows", async () => {
    const session = sid();
    const s = await getState(session);
    const deal = s.deals.find((d) => d.id === "tern")!;
    const { created } = buildDayOne(s, deal, DayOnePlan.parse(precomputed.f7.plan), session);
    await appendEvent({
      sessionId: session,
      actor: "jerome",
      type: "deal.led",
      entityType: "deal",
      entityId: deal.id,
      payload: { deal_id: deal.id, created: created as unknown as Record<string, unknown>, run_id: "run_test" },
    });
    await runTool("propose_next_step", { viewer: JEROME, sessionId: session }, VALID.propose_next_step);

    const slugs = (r: { data: unknown }) => (r.data as { companies: { slug: string }[] }).companies.map((c) => c.slug);
    const jerome = await runTool("list_portfolio", { viewer: JEROME, sessionId: session }, {});
    const pub = await runTool("list_portfolio", { viewer: PUBLIC_VIEWER, sessionId: session }, {});
    expect(slugs(jerome)).toContain(created.company.slug);
    expect(slugs(pub)).not.toContain(created.company.slug);

    const pubStats = await runTool("portfolio_stats", { viewer: PUBLIC_VIEWER, sessionId: session }, {});
    const seedStats = await runTool("portfolio_stats", { viewer: PUBLIC_VIEWER }, {});
    expect(pubStats.data).toEqual(seedStats.data);
    const pubPipe = await runTool("list_pipeline", { viewer: PUBLIC_VIEWER, sessionId: session }, {});
    const seedPipe = await runTool("list_pipeline", { viewer: PUBLIC_VIEWER }, {});
    expect(pubPipe.data).toEqual(seedPipe.data);
    await expect(runTool("get_company", { viewer: PUBLIC_VIEWER, sessionId: session }, { slug: created.company.slug })).rejects.toThrow();
    expect(getSeedState().companies.some((c) => c.id === created.company.id)).toBe(false);
  });
});
