/**
 * F5 · Board pack drafting (docs/07-ai.md F5). Context from Bridge records only, one streamed prose
 * call, and the no-financial-figures guardrail applied sentence by sentence before display.
 * Saved as a session draft (`board_pack.section_saved`, state drafted).
 */
import "server-only";
import { appendEvent, getState, type State } from "@/lib/data";
import { openConstraint } from "@/lib/domain/portfolio-stats";
import { callModel, plain } from "../client";
import { section, tone } from "../prompts";
import { BoardPackInput } from "../schemas/board-pack";
import { stripUngroundedFinancials } from "../guardrails";
import { precomputed } from "../precomputed";
import { chunkText, pace, replay } from "../replay";
import { withChannel } from "../stream";
import type { FlowEvent } from "../sse";
import type { BoardPackDraft } from "../types";
import { FALLBACK_MESSAGE, type FallbackReason, type FlowDef, type FlowRun } from "../runner";

type Input = { companyId: string; sectionKey: "letter" | "asks" };
const PILOT_STAGES = ["Not yet piloting", "Pilot", "Terms", "Contract", "Multi-site"];

export function boardPackContext(s: State, companyId: string): { text: string; packId: string; company: string; founder: string } {
  const c = s.companies.find((x) => x.id === companyId);
  const pack = s.board_packs.find((p) => p.company_id === companyId);
  if (!c || !pack) throw new Error("No board pack for this company");
  const founder = s.people.find((p) => p.id === c.ceo_person_id);
  const k = openConstraint(s, companyId);
  const plan = s.plans.find((p) => p.company_id === companyId);
  const pr = plan ? s.priorities.filter((p) => p.plan_id === plan.id).sort((a, b) => a.rank - b.rank) : [];
  const ledger = s.commitments.filter((x) => x.company_id === companyId).sort((a, b) => a.sort - b.sort);
  const pilots = s.pilots.filter((p) => p.company_id === companyId);
  const ops = s.extras.opsEntries[pack.id] ?? [];
  const minutes = s.board_meetings.filter((m) => m.company_id === companyId && m.kind === "past");
  const lines = [
    `Company: ${c.name}`,
    k ? `Binding constraint (${k.domain_id}): ${k.statement}` : "Binding constraint: none recorded",
    "Plan priorities:",
    ...pr.map((p) => `- ${p.rank}. ${p.title}${p.progress_note ? ` (${p.progress_note})` : ""}`),
    "Ledger (what Rypples owes):",
    ...ledger.map((x) => `- ${x.title}, from ${x.from_label}, due ${x.due_label}, ${x.status.replace("_", " ")}`),
    "Pilots:",
    ...pilots.map((p) => `- ${p.name}: ${PILOT_STAGES[p.stage] ?? p.stage}${s.extras.pilotConfirmed[p.id] != null ? " (confirmed by the founder this quarter)" : " (not yet confirmed this quarter)"}`),
    ops.length ? "Founder-entered operations:" : "Founder-entered operations: none yet",
    ...ops.map((o) => `- ${o.site}: uptime ${o.uptime_pct}%, output ${o.output_m3_day} m³/day`),
    "Last board:",
    ...minutes.map((m) => `- ${m.label}: ${m.note ?? ""}`),
  ];
  return { text: lines.join("\n"), packId: pack.id, company: c.name, founder: founder?.name ?? "the founder" };
}

async function save(run: FlowRun<Input>, packId: string, key: Input["sectionKey"], content: string): Promise<BoardPackDraft> {
  await appendEvent({
    sessionId: run.sessionId,
    actor: `founder:${run.input.companyId}`,
    type: "board_pack.section_saved",
    entityType: "board_pack_section",
    entityId: `${packId}:${key}`,
    payload: { pack_id: packId, section_key: key, content_md: content.slice(0, 6000), state: "drafted" },
  });
  return { pack_id: packId, section_key: key, content_md: content };
}

async function* live(run: FlowRun<Input>): AsyncGenerator<FlowEvent> {
  run.meta.promptVersion = "board-pack@v1";
  const s = await getState(run.sessionId);
  yield { type: "step", key: "context", state: "running" };
  const ctx = boardPackContext(s, run.input.companyId);
  yield { type: "step", key: "context", state: "done", detail: "From your Bridge records" };
  yield { type: "step", key: "draft", state: "running" };
  const content = yield* withChannel(async (push) => {
    let buf = "";
    let out = "";
    const flush = (all: boolean) => {
      const cut = all ? buf.length : Math.max(buf.lastIndexOf(". "), buf.lastIndexOf("\n")) + 1;
      if (cut <= 0) return;
      const { text } = stripUngroundedFinancials(buf.slice(0, cut), ctx.text);
      buf = buf.slice(cut);
      if (text) {
        out += text;
        push({ type: "token", text });
      }
    };
    await callModel(run.tracker, {
      task: "f5",
      system: [plain(`${tone()}\n\n${section("board-pack", run.input.sectionKey, { company: ctx.company, founder: ctx.founder })}`)],
      messages: [{ role: "user", content: `Records:\n${ctx.text}` }],
      max_tokens: 1500,
      effort: "medium",
      signal: run.signal,
      onText: (d) => {
        buf += d;
        flush(false);
      },
    });
    flush(true);
    return out.trim();
  });
  yield { type: "step", key: "draft", state: "done", detail: "Draft · edit before sharing" };
  const draft = await save(run, ctx.packId, run.input.sectionKey, content);
  yield { type: "result", id: run.runId, data: draft };
}

async function* cachedRun(run: FlowRun<Input>, reason: FallbackReason): AsyncGenerator<FlowEvent> {
  const f = precomputed.f5;
  if (run.input.companyId !== f.company_id) {
    yield { type: "fallback", reason, replaying: false, message: "Live drafting is paused for today." };
    return;
  }
  run.meta.precomputed = true;
  const s = await getState(run.sessionId);
  const ctx = boardPackContext(s, run.input.companyId);
  yield { type: "fallback", reason, replaying: true, message: FALLBACK_MESSAGE[reason] };
  yield { type: "step", key: "context", state: "running" };
  await pace(700);
  yield { type: "step", key: "context", state: "done", detail: "From your Bridge records" };
  yield { type: "step", key: "draft", state: "running" };
  const content = f.sections[run.input.sectionKey];
  yield* replay(chunkText(content), `f5:${run.input.sectionKey}`);
  yield { type: "step", key: "draft", state: "done", detail: "Draft · edit before sharing" };
  const draft = await save(run, ctx.packId, run.input.sectionKey, content);
  yield { type: "result", id: run.runId, data: draft };
}

export const boardPackFlow: FlowDef<Input> = {
  flow: "board-pack",
  input: BoardPackInput,
  surface: () => "board-pack",
  live,
  cached: cachedRun,
};
