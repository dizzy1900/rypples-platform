/**
 * F4 · Lesson matching, the Ripple (docs/07-ai.md F4). Deterministic pre-filter, one structured call,
 * validated (ids exist, reasons cite a specific company fact). Returned as a proposal only: the
 * screen applies it with "Use these matches" (lesson.matches_replaced).
 */
import "server-only";
import { getState, type State } from "@/lib/data";
import { isActivePublic, openConstraint } from "@/lib/domain/portfolio-stats";
import { plain, structuredCall } from "../client";
import { section, tone } from "../prompts";
import { LessonMatchInput, LessonMatchJson, LessonMatchOut, reasonCitesFact } from "../schemas/lesson-match";
import { lowerEnums } from "../schemas/common";
import { precomputed } from "../precomputed";
import { pace } from "../replay";
import type { FlowEvent } from "../sse";
import type { LessonMatchResult } from "../types";
import { FALLBACK_MESSAGE, type FallbackReason, type FlowDef, type FlowRun } from "../runner";

type Input = { lessonId: string };

/** Active public companies, excluding the lesson's source company and exits. */
export function eligibleFor(s: State, lessonId: string) {
  const lesson = s.lessons.find((l) => l.id === lessonId);
  if (!lesson) return null;
  const source = s.companies.find((c) => lesson.learned_in.toLowerCase().includes(c.name.toLowerCase()) || lesson.id.startsWith(`${c.id}-`));
  const companies = s.companies.filter((c) => isActivePublic(c) && c.id !== source?.id);
  return { lesson, sourceId: source?.id ?? null, companies };
}

export function companyFacts(s: State, companyId: string): string[] {
  const c = s.companies.find((x) => x.id === companyId)!;
  const k = openConstraint(s, companyId);
  const path = s.strategic_paths.find((p) => p.company_id === companyId);
  return [
    c.tagline ?? "",
    ...s.facts.filter((f) => f.company_id === companyId).map((f) => `${f.label}: ${f.value}`),
    k ? `Current constraint (${k.domain_id}): ${k.statement}` : "",
    path ? `Strategic relationships today: ${path.now}` : "",
    ...s.enrolments.filter((e) => e.company_id === companyId && e.status === "running").map((e) => `Running program: ${s.programs.find((p) => p.id === e.program_id)?.name ?? e.program_id}`),
  ].filter(Boolean);
}

async function* live(run: FlowRun<Input>): AsyncGenerator<FlowEvent> {
  run.meta.promptVersion = "lesson-match@v1";
  const s = await getState(run.sessionId);
  const el = eligibleFor(s, run.input.lessonId);
  if (!el) throw new Error("Unknown lesson");
  yield { type: "step", key: "filter", state: "running" };
  yield { type: "step", key: "filter", state: "done", detail: `${el.companies.length} eligible companies` };
  yield { type: "step", key: "match", state: "running" };
  const ids = new Set(el.companies.map((c) => c.id));
  const facts = new Map(el.companies.map((c) => [c.id, companyFacts(s, c.id)]));
  const input = el.companies.map((c) => `- id: ${c.id} | ${c.name} | ${c.vertical ?? ""} | ${c.stage ?? ""}\n  ${facts.get(c.id)!.join("\n  ")}`).join("\n");
  const out = await structuredCall(run.tracker, {
    task: "f4",
    system: [plain(`${tone()}\n\n${section("lesson-match", "match")}`)],
    messages: [{ role: "user", content: `Lesson: ${el.lesson.title}\nDomain: ${el.lesson.domain_id}\nPlay:\n${el.lesson.play.map((p) => `- ${p}`).join("\n")}\n\nEligible companies:\n${input}` }],
    max_tokens: 2000,
    signal: run.signal,
    schema: LessonMatchOut,
    jsonSchema: LessonMatchJson,
    normalize: (raw) => lowerEnums(raw, ["fit"]),
    check: (v) =>
      v.matches.flatMap((m) =>
        !ids.has(m.company_id) ? [`unknown company ${m.company_id}`] : reasonCitesFact(m.reason, facts.get(m.company_id)!) ? [] : [`reason for ${m.company_id} cites no specific fact`],
      ),
  });
  const matches = out.matches.filter((m) => ids.has(m.company_id) && reasonCitesFact(m.reason, facts.get(m.company_id)!)).slice(0, 3);
  const matched = new Set(matches.map((m) => m.company_id));
  const excluded = el.companies
    .filter((c) => !matched.has(c.id))
    .map((c) => ({ company_id: c.id, reason: out.excluded.find((x) => x.company_id === c.id)?.reason ?? "Not a close fit for this lesson right now." }));
  yield { type: "step", key: "match", state: "done", detail: `${matches.length} proposed` };
  const result: LessonMatchResult = { lesson_id: el.lesson.id, matches, excluded };
  yield { type: "result", id: run.runId, data: result };
}

async function* cachedRun(run: FlowRun<Input>, reason: FallbackReason): AsyncGenerator<FlowEvent> {
  const f = precomputed.f4;
  if (run.input.lessonId !== f.result.lesson_id) {
    yield { type: "fallback", reason, replaying: false, message: "Live runs are paused for today." };
    return;
  }
  run.meta.precomputed = true;
  yield { type: "fallback", reason, replaying: true, message: FALLBACK_MESSAGE[reason] };
  const s = await getState(run.sessionId);
  const el = eligibleFor(s, f.result.lesson_id);
  yield { type: "step", key: "filter", state: "running" };
  await pace(700);
  yield { type: "step", key: "filter", state: "done", detail: `${el?.companies.length ?? 0} eligible companies` };
  yield { type: "step", key: "match", state: "running" };
  await pace(1100);
  yield { type: "step", key: "match", state: "done", detail: `${f.result.matches.length} proposed` };
  yield { type: "result", id: run.runId, data: f.result };
}

export const lessonMatchFlow: FlowDef<Input> = {
  flow: "lesson-match",
  input: LessonMatchInput,
  surface: () => "lesson-match",
  live,
  cached: cachedRun,
};
