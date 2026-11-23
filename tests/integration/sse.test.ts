/**
 * Every flow route in replay mode (LIVE_AI=off) emits a valid FlowEvent sequence ending in `result`
 * (docs/11 §2). Handlers are called directly with a Request; no server needed.
 */
import { describe, expect, it } from "vitest";
import { FlowEventSchema, type FlowEvent } from "@/lib/ai/sse";
import { getStore } from "@/lib/data";
import { f2Fixture } from "@/lib/ai/precomputed";
import { normaliseQuery } from "@/lib/ai/evidence";
import * as diagnostic from "@/app/api/ai/diagnostic/route";
import * as anyCompany from "@/app/api/ai/any-company/route";
import * as captain from "@/app/api/ai/captain/route";
import * as lessonMatch from "@/app/api/ai/lesson-match/route";
import * as boardPack from "@/app/api/ai/board-pack/route";
import * as shareholder from "@/app/api/ai/shareholder-update/route";
import * as dayOne from "@/app/api/ai/day-one/route";

const session = () => `test-sse-${Math.random().toString(36).slice(2)}`;
const post = (url: string, body: unknown, sid = session()) =>
  new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `rp_demo=${sid}`, "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify(body),
  });

async function events(res: Response): Promise<FlowEvent[]> {
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
  const text = await res.text();
  const out: FlowEvent[] = [];
  for (const block of text.split(/\n\n+/)) {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    const parsed = FlowEventSchema.safeParse(JSON.parse(data));
    expect(parsed.success, `invalid event: ${data.slice(0, 200)}`).toBe(true);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function assertSequence(ev: FlowEvent[]) {
  expect(ev[0]).toMatchObject({ type: "mode", mode: "cached" });
  expect(ev.at(-1)!.type).toBe("result");
  expect(ev.filter((e) => e.type === "result")).toHaveLength(1);
  expect(ev.some((e) => e.type === "error")).toBe(false);
  return ev.at(-1) as Extract<FlowEvent, { type: "result" }>;
}

describe("SSE contract per flow route (replay mode)", () => {
  it("F1 diagnostic", async () => {
    const ev = await events(await diagnostic.POST(post("/api/ai/diagnostic", { companyId: "desolenator" })));
    const r = assertSequence(ev);
    expect(ev.some((e) => e.type === "evidence")).toBe(true);
    expect(ev.filter((e) => e.type === "score")).toHaveLength(8);
    expect(r.id).toMatch(/^diag-/);
  });

  it("F2 any company: replays a stored run", async () => {
    const fx = await f2Fixture("ok");
    const res = fx.result!;
    const q = normaliseQuery(res.identity.website ?? res.identity.name);
    await getStore().putAnyCompanyRun({ id: res.run_id, domain: q.key, display_name: res.identity.name, status: res.status, result: { ...res, created_at: new Date().toISOString() }, run_id: res.run_id, created_at: new Date().toISOString() });
    const ev = await events(await anyCompany.POST(post("/api/ai/any-company", { query: res.identity.website ?? res.identity.name })));
    const r = assertSequence(ev);
    expect(r.id).toBe(res.run_id);
  });

  it("F2 any company: with nothing stored, ends in a non-replaying fallback", async () => {
    const ev = await events(await anyCompany.POST(post("/api/ai/any-company", { query: "Nothing Stored Marine Ltd" })));
    expect(ev[0]).toMatchObject({ type: "mode", mode: "cached" });
    expect(ev.at(-1)).toMatchObject({ type: "fallback", replaying: false });
    expect(ev.some((e) => e.type === "result")).toBe(false);
  });

  it("F3 Captain (os and bridge)", async () => {
    const os = await events(await captain.POST(post("/api/ai/captain", { message: "Where is Growth Engine capacity tight this quarter?", scope: { kind: "os" } })));
    const r = assertSequence(os);
    expect(os.some((e) => e.type === "token")).toBe(true);
    expect((r.data as { untraced: string[] }).untraced).toEqual([]);
    const br = await events(await captain.POST(post("/api/ai/captain", { message: "Where is our board pack?", scope: { kind: "bridge", slug: "desolenator" } })));
    assertSequence(br);
  });

  it("F3 Captain: unknown bridge slug is a 404", async () => {
    const res = await captain.POST(post("/api/ai/captain", { message: "Hi", scope: { kind: "bridge", slug: "nobody" } }));
    expect(res.status).toBe(404);
  });

  it("F4 lesson match", async () => {
    const r = assertSequence(await events(await lessonMatch.POST(post("/api/ai/lesson-match", { lessonId: "wsense-strategic" }))));
    expect((r.data as { matches: unknown[] }).matches.length).toBeGreaterThan(0);
  });

  it("F5 board pack (letter and asks)", async () => {
    const sid = session();
    for (const sectionKey of ["letter", "asks"]) {
      const ev = await events(await boardPack.POST(post("/api/ai/board-pack", { companyId: "desolenator", sectionKey }, sid)));
      const r = assertSequence(ev);
      expect(ev.some((e) => e.type === "token")).toBe(true);
      expect((r.data as { content_md: string }).content_md.length).toBeGreaterThan(50);
    }
  });

  it("F6 shareholder update", async () => {
    const ev = await events(await shareholder.POST(post("/api/ai/shareholder-update", {})));
    assertSequence(ev);
    expect(ev.some((e) => e.type === "refs")).toBe(true);
  });

  it("F7 day one, then an error when the deal is already led", async () => {
    const sid = session();
    const r = assertSequence(await events(await dayOne.POST(post("/api/ai/day-one", { dealId: "tern" }, sid))));
    expect(r.id).toBe("tern");
    const again = await events(await dayOne.POST(post("/api/ai/day-one", { dealId: "tern" }, sid)));
    expect(again.at(-1)!.type).toBe("error");
  });

  it("rejects invalid input with a 400 before streaming", async () => {
    expect((await diagnostic.POST(post("/api/ai/diagnostic", { companyId: "" }))).status).toBe(400);
    expect((await captain.POST(post("/api/ai/captain", { message: "", scope: { kind: "os" } }))).status).toBe(400);
  });
});
