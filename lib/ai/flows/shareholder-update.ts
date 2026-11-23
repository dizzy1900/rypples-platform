/**
 * F6 · Shareholder update (docs/07-ai.md F6). Approved records only, passed as {type, id, field, value,
 * provenance}; one structured call; every figure must be a ref the platform resolves from the record.
 * Text segments with digits (other than years and quarter labels) fail validation and retry once.
 */
import "server-only";
import { appendEvent, getState, type State } from "@/lib/data";
import { resolveRef, type RefInput } from "@/lib/data/projections/refs";
import { plain, structuredCall, ValidationFailure } from "../client";
import { section, tone } from "../prompts";
import { ShareholderInput, ShareholderJson, ShareholderOut, shareholderIssues, type ShareholderOutT } from "../schemas/shareholder-update";
import { precomputed } from "../precomputed";
import { pace } from "../replay";
import type { FlowEvent, Ref } from "../sse";
import type { ShareholderDraft } from "../types";
import { FALLBACK_MESSAGE, type FallbackReason, type FlowDef, type FlowRun } from "../runner";
import { href } from "@/lib/tools/types";

type Input = { quarter: string };

const CANDIDATES: RefInput[] = [
  ...["backed", "active", "exits", "firm_rating", "programs_running", "lessons_sent", "impact_reporting", "over_benchmark"].map((field) => ({ type: "portfolio", id: "stats", field })),
  { type: "exit", id: "wsense", field: "note" },
  { type: "exit", id: "wsense", field: "package" },
  { type: "company", id: "desolenator", field: "name" },
  { type: "company", id: "desolenator", field: "round_closed_at" },
  { type: "company", id: "desolenator", field: "day" },
];

/** Approved records (with values read from state) and held-back records. */
export function shareholderRecords(s: State) {
  const records = [...CANDIDATES, ...s.lessons.filter((l) => l.status === "approved").map((l) => ({ type: "lesson", id: l.id, field: "title" }))]
    .map((r) => ({ ...r, resolved: resolveRef(s, r) }))
    .filter((r) => r.resolved)
    .map((r) => ({ type: r.type, id: r.id, field: r.field, value: r.resolved!.value, provenance: r.resolved!.provenance }));
  const heldBack = [
    ...s.lessons.filter((l) => l.status === "proposed").map((l) => ({ type: "lesson", id: l.id, reason: "Proposed, not yet approved." })),
    ...s.decisions.filter((d) => d.status === "open").map((d) => ({ type: "decision", id: d.id, reason: `Open decision: ${d.question}` })),
    ...s.deals.filter((d) => d.stage !== "led").map((d) => ({ type: "deal", id: d.id, reason: "Pipeline deals are never disclosed." })),
  ];
  return { records, heldBack };
}

function refsFor(s: State, d: Pick<ShareholderDraft, "segments">): Ref[] {
  const out: Ref[] = [];
  for (const seg of d.segments) {
    if (seg.kind !== "ref") continue;
    const r = resolveRef(s, seg.ref);
    if (!r || out.some((x) => x.type === seg.ref.type && x.id === `${seg.ref.id}.${seg.ref.field}`)) continue;
    out.push({ type: seg.ref.type, id: `${seg.ref.id}.${seg.ref.field}`, label: r.label, ...(r.href ? { href: href(r.href) } : {}), provenance: r.provenance });
  }
  return out;
}

async function save(run: FlowRun<Input>, s: State, d: Omit<ShareholderDraft, "draft_n">): Promise<ShareholderDraft> {
  const prev = s.extras.shareholderDraft[d.quarter] as { draft_n?: number } | undefined;
  const draft: ShareholderDraft = { ...d, draft_n: (prev?.draft_n ?? precomputed.f6.draft_n ?? 1) + 1 };
  await appendEvent({
    sessionId: run.sessionId,
    actor: "jerome",
    type: "shareholder_update.redrafted",
    entityType: "shareholder_update",
    entityId: d.quarter,
    payload: { quarter: d.quarter, draft, run_id: run.runId },
  });
  return draft;
}

async function* live(run: FlowRun<Input>): AsyncGenerator<FlowEvent> {
  run.meta.promptVersion = "shareholder-update@v1";
  const s = await getState(run.sessionId);
  yield { type: "step", key: "records", state: "running" };
  const { records, heldBack } = shareholderRecords(s);
  yield { type: "step", key: "records", state: "done", detail: `${records.length} approved records, ${heldBack.length} held back` };
  yield { type: "step", key: "draft", state: "running" };
  const resolves = (r: RefInput) => !!resolveRef(s, r);
  const out: ShareholderOutT = await structuredCall(run.tracker, {
    task: "f6",
    system: [plain(`${tone()}\n\n${section("shareholder-update", "draft", { quarter: run.input.quarter })}`)],
    messages: [
      {
        role: "user",
        content: `Approved records:\n${records.map((r) => `- type: ${r.type} | id: ${r.id} | field: ${r.field} | value: ${r.value} | provenance: ${r.provenance}`).join("\n")}\n\nHeld back:\n${heldBack.map((h) => `- type: ${h.type} | id: ${h.id} | reason: ${h.reason}`).join("\n")}`,
      },
    ],
    max_tokens: 3000,
    effort: "medium",
    signal: run.signal,
    schema: ShareholderOut,
    jsonSchema: ShareholderJson,
    check: (d) => shareholderIssues(d, resolves),
  });
  yield { type: "step", key: "draft", state: "done" };
  yield { type: "step", key: "validate", state: "running" };
  const segments = out.segments.filter((x) => x.kind === "text" || resolves(x.ref));
  const issues = shareholderIssues({ ...out, segments }, resolves);
  if (issues.length) throw new ValidationFailure("Shareholder update failed validation", issues);
  yield { type: "step", key: "validate", state: "done", detail: "Every figure read from a record" };
  const draft = await save(run, s, { quarter: run.input.quarter, title: out.title, segments, held_back: out.held_back });
  yield { type: "refs", refs: refsFor(s, draft) };
  yield { type: "result", id: run.runId, data: draft };
}

async function* cachedRun(run: FlowRun<Input>, reason: FallbackReason): AsyncGenerator<FlowEvent> {
  const f = precomputed.f6;
  if (run.input.quarter !== f.quarter) {
    yield { type: "fallback", reason, replaying: false, message: "Live drafting is paused for today." };
    return;
  }
  run.meta.precomputed = true;
  const s = await getState(run.sessionId);
  const { records, heldBack } = shareholderRecords(s);
  yield { type: "fallback", reason, replaying: true, message: FALLBACK_MESSAGE[reason] };
  for (const [key, detail, ms] of [
    ["records", `${records.length} approved records, ${heldBack.length} held back`, 800],
    ["draft", undefined, 1100],
    ["validate", "Every figure read from a record", 700],
  ] as const) {
    yield { type: "step", key, state: "running" };
    await pace(ms);
    yield { type: "step", key, state: "done", ...(detail ? { detail } : {}) };
  }
  const draft = await save(run, s, { quarter: f.quarter, title: f.title, segments: f.segments, held_back: f.held_back });
  yield { type: "refs", refs: refsFor(s, draft) };
  yield { type: "result", id: run.runId, data: draft };
}

export const shareholderUpdateFlow: FlowDef<Input> = {
  flow: "shareholder-update",
  input: ShareholderInput,
  surface: () => "shareholder-update",
  live,
  cached: cachedRun,
};
