/**
 * F3 · Captain conversation (docs/07-ai.md F3, docs/06-screens.md S10).
 * Tool loop over the registry (strict client tools, ≤ 6 iterations, no web tools), ref markers
 * validated against this turn's tool results, numeric grounding check, thread in captain_messages.
 * Cached mode answers the suggested prompts from precomputed text, running the listed tools for real.
 */
import "server-only";
import { ulid } from "ulid";
import type { BetaContentBlockParam, BetaMessageParam, BetaToolResultBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { appendEvent, getState, getStore, type State } from "@/lib/data";
import type { CaptainMessage } from "@/lib/data/store";
import { founderViewer, JEROME, type Viewer } from "@/lib/viewer";
import { getKv } from "@/lib/redis";
import { connectedStrip } from "@/lib/integrations/config";
import { runTool, toAnthropicTools } from "@/lib/tools/registry";
import { uniqRefs, type ToolResult } from "@/lib/tools/types";
import { cached, callModel, textOf } from "../client";
import { section, tone } from "../prompts";
import { CaptainInput } from "../schemas/captain";
import { parseRefMarkers, stripRefMarkers, untracedNumbers } from "../guardrails";
import { precomputed, type CaptainCached } from "../precomputed";
import { chunkText, replay } from "../replay";
import { withChannel } from "../stream";
import { getMode } from "../budget";
import type { FlowEvent, Ref } from "../sse";
import type { CaptainAnswer, CaptainBootstrap, CaptainProposal, CaptainScopeInput, CaptainThreadMessage } from "../types";
import { FALLBACK_MESSAGE, type FallbackReason, type FlowDef, type FlowRun } from "../runner";

type Input = { message: string; scope: CaptainScopeInput };
const MAX_ITER = 6;
const THREAD = 10;
export const PAUSED_MESSAGE = "Live answers are paused for today. Try one of these.";

export type ViewerInfo = { viewer: Viewer; viewerKind: "rypples" | "founder"; companyId: string | null; companyName: string | null; slug: string | null };

export class CaptainScopeNotFound extends Error {}

export function resolveViewer(s: State, scope: CaptainScopeInput): ViewerInfo {
  if (scope.kind === "os") return { viewer: JEROME, viewerKind: "rypples", companyId: null, companyName: null, slug: null };
  const c = s.companies.find((x) => x.slug === scope.slug && (x.ceo_person_id || x.session_added));
  if (!c) throw new CaptainScopeNotFound(`No Bridge workspace for ${scope.slug}`);
  return { viewer: founderViewer(c.id, c.ceo_person_id ?? `${c.id}-ceo`), viewerKind: "founder", companyId: c.id, companyName: c.name, slug: c.slug };
}

type ToolLog = { name: string; input: unknown; result: ToolResult<unknown> | null; error?: string };

function recordsRead(log: ToolLog[]): number {
  let n = 0;
  for (const l of log) {
    if (!l.result) continue;
    const d = l.result.data as Record<string, unknown> | null;
    const arrays = d && typeof d === "object" ? Object.values(d).filter(Array.isArray) : [];
    n += arrays.length ? arrays.reduce((a, x) => a + (x as unknown[]).length, 0) : 1;
  }
  return n;
}

const CAVEAT = /[^.\n]*(low confidence|outside reference|indicative|illustrative|not approved|proposed, not)[^.\n]*[.]?/gi;

/** Build the answer payload: validated chips, stripped text, untraced numbers. */
export function buildAnswer(o: {
  messageId: string;
  question: string;
  rawText: string;
  log: ToolLog[];
  nextSteps: CaptainProposal[];
  caveats?: string[];
  fromCache: boolean;
}): CaptainAnswer {
  const all = uniqRefs(o.log.flatMap((l) => l.result?.refs ?? []));
  const byKey = new Map(all.map((r) => [`${r.type}/${r.id}`, r]));
  const chips: Ref[] = [];
  for (const m of parseRefMarkers(o.rawText)) {
    const r = byKey.get(`${m.type}/${m.id}`);
    if (r && !chips.includes(r)) chips.push(r);
  }
  const refs = chips.length ? chips : all.slice(0, 3);
  const results = o.log.map((l) => (l.result ? JSON.stringify(l.result.data) : ""));
  const text = stripRefMarkers(o.rawText).trim();
  return {
    message_id: o.messageId,
    question: o.question,
    text,
    untraced: untracedNumbers(o.rawText, results),
    refs,
    records_read: recordsRead(o.log),
    next_steps: o.nextSteps,
    caveats: o.caveats ?? [...new Set((text.match(CAVEAT) ?? []).map((x) => x.trim()))],
    from_cache: o.fromCache,
    paused: null,
  };
}

async function saveTurn(run: FlowRun<Input>, vi: ViewerInfo, question: string, answer: CaptainAnswer) {
  const store = getStore();
  const at = Date.now();
  const base = { session_id: run.sessionId, viewer_kind: vi.viewerKind, company_id: vi.companyId, run_id: run.runId };
  await store.appendCaptainMessage({ ...base, id: `msg_${ulid()}`, role: "user", content: { text: question }, created_at: new Date(at).toISOString() });
  await store.appendCaptainMessage({ ...base, id: answer.message_id, role: "assistant", content: { text: answer.text, answer }, created_at: new Date(at + 1).toISOString() });
}

const proposalsFrom = (log: ToolLog[]): CaptainProposal[] =>
  log
    .filter((l) => l.name === "propose_next_step" && l.result)
    .map((l) => {
      const inp = l.input as { title?: string; detail?: string; target?: string | null };
      const d = l.result!.data as { proposal_id: string };
      return { proposal_id: d.proposal_id, title: inp.title ?? "", detail: inp.detail ?? "", target: inp.target ?? null };
    });

async function* live(run: FlowRun<Input>): AsyncGenerator<FlowEvent> {
  run.meta.promptVersion = "captain@v1";
  const s = await getState(run.sessionId);
  const vi = resolveViewer(s, run.input.scope);
  const ctx = { viewer: vi.viewer, sessionId: run.sessionId };
  const role = vi.viewerKind === "rypples" ? section("captain", "role_os") : section("captain", "role_founder", { company: vi.companyName ?? "" });
  const system = [cached(`${role}\n\n${section("captain", "answer")}\n\n${tone()}`)];
  const tools = toAnthropicTools(vi.viewer);
  const prior = await getStore().listCaptainMessages(run.sessionId, vi.viewerKind, vi.companyId, THREAD);
  const history: BetaMessageParam[] = [];
  for (const m of prior) {
    const text = String((m.content as { text?: string })?.text ?? "").trim();
    if (!text) continue;
    if (!history.length && m.role !== "user") continue;
    if (history.length && history[history.length - 1]!.role === m.role) continue;
    history.push({ role: m.role, content: text });
  }
  if (history.length && history[history.length - 1]!.role === "user") history.pop();
  const messages: BetaMessageParam[] = [...history, { role: "user", content: run.input.message }];
  const log: ToolLog[] = [];

  const rawText = yield* withChannel(async (push) => {
    let last = "";
    for (let i = 0; i < MAX_ITER; i++) {
      const msg = await callModel(run.tracker, {
        task: "f3",
        system,
        messages,
        tools,
        max_tokens: 2000,
        effort: "medium",
        signal: run.signal,
        onText: (d) => push({ type: "token", text: d }),
      });
      last = textOf(msg);
      const uses = msg.content.filter((b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use");
      if (msg.stop_reason !== "tool_use" || !uses.length) break;
      push({ type: "step", key: "tools", state: "running", detail: uses.map((u) => u.name).join(", ") });
      const results: BetaToolResultBlockParam[] = [];
      for (const u of uses) {
        try {
          const r = await runTool(u.name, ctx, u.input);
          log.push({ name: u.name, input: u.input, result: r });
          results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r) });
        } catch (err) {
          const message = (err as Error).message || "Tool failed";
          log.push({ name: u.name, input: u.input, result: null, error: message });
          results.push({ type: "tool_result", tool_use_id: u.id, content: message, is_error: true });
        }
      }
      push({ type: "step", key: "tools", state: "done", detail: `${log.length} tool calls` });
      messages.push({ role: "assistant", content: msg.content as unknown as BetaContentBlockParam[] });
      messages.push({ role: "user", content: results });
      if (i === MAX_ITER - 1) last ||= "I couldn't finish looking that up. Try a narrower question.";
    }
    return last;
  });

  const answer = buildAnswer({ messageId: `msg_${ulid()}`, question: run.input.message, rawText, log, nextSteps: proposalsFrom(log), fromCache: false });
  run.meta.capture = { rawText, tools: log.filter((l) => l.name !== "propose_next_step").map((l) => ({ name: l.name, input: l.input })) };
  if (answer.untraced.length && !process.env.VITEST) console.warn(JSON.stringify({ level: "warn", msg: "untraced numbers", run_id: run.runId, untraced: answer.untraced }));
  yield { type: "refs", refs: answer.refs };
  await saveTurn(run, vi, run.input.message, answer);
  yield { type: "result", id: answer.message_id, data: answer };
}

const norm = (x: string) => x.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

export function matchCached(question: string, scope: "os" | "bridge"): CaptainCached | null {
  const q = norm(question);
  const pool = precomputed.f3.answers.filter((a) => a.scope === scope);
  return pool.find((a) => norm(a.prompt) === q) ?? pool.find((a) => a.match.some((group) => group.every((w) => q.includes(w)))) ?? null;
}

/** Run a cached answer's tool calls for real and build the answer (no persistence). */
export async function cachedAnswer(a: CaptainCached, vi: ViewerInfo, sessionId: string | null, messageId: string, nextSteps: CaptainProposal[]) {
  const log: ToolLog[] = [];
  for (const call of a.tools) {
    try {
      log.push({ name: call.name, input: call.input, result: await runTool(call.name, { viewer: vi.viewer, sessionId }, call.input) });
    } catch (err) {
      log.push({ name: call.name, input: call.input, result: null, error: (err as Error).message });
    }
  }
  return buildAnswer({ messageId, question: a.prompt, rawText: a.text, log, nextSteps, caveats: a.caveats, fromCache: true });
}

async function* cachedRun(run: FlowRun<Input>, reason: FallbackReason): AsyncGenerator<FlowEvent> {
  const s = await getState(run.sessionId);
  const vi = resolveViewer(s, run.input.scope);
  const scope = vi.viewerKind === "rypples" ? "os" : "bridge";
  const hit = matchCached(run.input.message, scope);
  if (!hit) {
    const prompts = precomputed.f3.prompts[scope];
    yield { type: "fallback", reason, replaying: false, message: PAUSED_MESSAGE };
    const paused: CaptainAnswer = { message_id: "", question: run.input.message, text: "", untraced: [], refs: [], records_read: 0, next_steps: [], caveats: [], from_cache: true, paused: { message: PAUSED_MESSAGE, prompts } };
    yield { type: "result", id: run.runId, data: paused };
    return;
  }
  run.meta.precomputed = true;
  run.meta.promptVersion = precomputed.f3.prompt_version ?? "captain@v1";
  yield { type: "fallback", reason, replaying: true, message: FALLBACK_MESSAGE[reason] };
  yield { type: "step", key: "tools", state: "running", detail: hit.tools.map((t) => t.name).join(", ") };
  const nextSteps: CaptainProposal[] = [];
  for (const n of hit.next_steps) {
    const id = `prop-${ulid()}`;
    await appendEvent({
      sessionId: run.sessionId,
      actor: vi.viewerKind === "rypples" ? "jerome" : `founder:${vi.companyId}`,
      type: "proposal.created",
      entityType: "proposal",
      entityId: id,
      payload: { proposal_id: id, flow: "captain", kind: "next_step", title: n.title, detail: n.detail, target: n.target, run_id: run.runId },
    });
    nextSteps.push({ proposal_id: id, ...n });
  }
  const answer = await cachedAnswer(hit, vi, run.sessionId, `msg_${ulid()}`, nextSteps);
  yield { type: "step", key: "tools", state: "done", detail: `${hit.tools.length} tool calls` };
  yield* replay(chunkText(hit.text), `f3:${hit.id}`);
  yield { type: "refs", refs: answer.refs };
  await saveTurn(run, vi, run.input.message, { ...answer, question: run.input.message });
  yield { type: "result", id: answer.message_id, data: { ...answer, question: run.input.message } };
}

export const captainFlow: FlowDef<Input> = {
  flow: "captain",
  input: CaptainInput,
  surface: () => "captain",
  live,
  cached: cachedRun,
};

// ── Bootstrap (GET) and reset (DELETE) ──────────────────────────────────

const clearedKey = (sessionId: string, vi: ViewerInfo) => `captain:cleared:${sessionId}:${vi.viewerKind}:${vi.companyId ?? "-"}`;

function toThread(rows: CaptainMessage[]): CaptainThreadMessage[] {
  return rows.map((m) => {
    const c = (m.content ?? {}) as { text?: string; answer?: CaptainAnswer };
    return { id: m.id, role: m.role, text: c.text ?? "", answer: c.answer ?? null, created_at: m.created_at };
  });
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export async function captainBootstrap(sessionId: string, scope: CaptainScopeInput, priority: boolean): Promise<CaptainBootstrap> {
  const s = await getState(sessionId);
  const vi = resolveViewer(s, scope);
  const os = vi.viewerKind === "rypples";
  const proposals: Record<string, "proposed" | "approved" | "rejected"> = {};
  for (const p of s.extras.proposals) proposals[p.id] = p.status;
  const rows = await getStore().listCaptainMessages(sessionId, vi.viewerKind, vi.companyId, 50);
  const cleared = (await getKv().get(clearedKey(sessionId, vi))) === "1";
  const mode = (await getMode("captain", { priority })).mode;

  let seeded: CaptainBootstrap["seeded"] = null;
  if (os && !cleared) {
    const a = precomputed.f3.answers.find((x) => x.id === precomputed.f3.seeded.answer_id);
    if (a) {
      const steps = a.next_steps.map((n, i) => ({ proposal_id: `seed-${a.id}-${i + 1}`, ...n }));
      seeded = { label: precomputed.f3.seeded.label, answer: await cachedAnswer(a, vi, sessionId, `seed-${a.id}`, steps) };
    }
  }
  const minutes = new Map(precomputed.overnight.items.map((x) => [x.id, x.minutes]));
  const overnight: CaptainBootstrap["overnight"] = os
    ? s.captain_overnight.map((o) => ({
        id: o.id,
        what: o.what,
        state: o.state,
        route: o.route,
        action: o.action,
        status: proposals[o.id] ?? "proposed",
        at_label: minutes.has(o.id) ? `Today ${hhmm(minutes.get(o.id)!)}` : "Overnight",
      }))
    : [];
  const since_last: CaptainBootstrap["since_last"] = [];
  if (!os && vi.companyId) {
    for (const x of s.extras.sentLessons.filter((l) => l.company_id === vi.companyId)) {
      const l = s.lessons.find((y) => y.id === x.lesson_id);
      if (l) since_last.push({ id: `lesson-${l.id}`, what: `Lesson received: ${l.title}`, route: `/bridge/${vi.slug}`, tone: "lime" });
    }
    for (const c of s.commitments.filter((c) => c.company_id === vi.companyId && c.status === "delivered")) {
      since_last.push({ id: `commitment-${c.id}`, what: `Delivered: ${c.title}`, route: `/bridge/${vi.slug}`, tone: c.rating == null ? "amber" : "neutral" });
    }
  }
  return {
    scope,
    company_name: vi.companyName,
    mode,
    overnight,
    since_last,
    seeded,
    thread: toThread(rows),
    prompts: precomputed.f3.prompts[os ? "os" : "bridge"],
    proposals,
    connected: connectedStrip(),
    placeholder: os ? "Ask Captain about the portfolio" : "Ask Captain how other Rypples companies handled it",
    actor: os ? "jerome" : `founder:${vi.companyId}`,
  };
}

export async function captainReset(sessionId: string, scope: CaptainScopeInput) {
  const s = await getState(sessionId);
  const vi = resolveViewer(s, scope);
  await getStore().clearCaptainThread(sessionId, vi.viewerKind, vi.companyId);
  await getKv().set(clearedKey(sessionId, vi), "1", 7 * 24 * 3600);
}
