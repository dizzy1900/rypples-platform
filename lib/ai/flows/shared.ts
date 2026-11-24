/**
 * Pieces shared by F1 and F2: the cached taxonomy prefix, parallel per-domain scoring and synthesis
 * (docs/07-ai.md F1 steps 2-3, F2 step 3).
 */
import "server-only";
import type { BetaTextBlockParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { State } from "@/lib/data";
import type { DomainSlug } from "@/lib/domain/schemas";
import { cached, plain, structuredCall, ValidationFailure, type AiTask, type Tracker } from "../client";
import { section, tone } from "../prompts";
import type { FlowEvent } from "../sse";
import type { EvidenceItem, ScoredDomain, Synthesis } from "../types";
import {
  DomainScore,
  DomainScoreJson,
  SCORE_ENUMS,
  scoreIssues,
  Synthesis as SynthesisSchema,
  SynthesisJson,
  SYNTH_ENUMS,
  synthesisIssues,
} from "../schemas/diagnostic";
import { lowerEnums } from "../schemas/common";

export const DOMAIN_ORDER = (s: State) => [...s.domains].sort((a, b) => a.sort - b.sort);

/** Static, cacheable system prefix: tone + taxonomy + program catalogue + Playbook summaries. */
export function taxonomyPrefix(s: State, company: string): BetaTextBlockParam {
  const domains = DOMAIN_ORDER(s).map((d) => `- ${d.slug}: ${d.label}. ${d.note}`).join("\n");
  const programs = s.programs.map((p) => `- ${p.id}: ${p.name} (${p.domain_id}). ${p.outcome}`).join("\n");
  const lessons = s.lessons.filter((l) => l.status !== "rejected").map((l) => `- ${l.id}: ${l.title} (${l.domain_id}, ${l.status})`).join("\n");
  // company name lives outside the cached block so the prefix is shared across companies
  void company;
  return cached(`${tone()}\n\n${section("diagnostic", "taxonomy", { domains, programs, lessons })}`);
}

export const evidenceList = (ev: EvidenceItem[]) =>
  ev.map((e) => `[${e.id}] ${e.claim} | cited: "${e.cited_text}" | source: ${e.title}${e.url ? ` (${e.url})` : ""}`).join("\n");

export const evidenceGap = (domain: DomainSlug): ScoredDomain => ({ domain, score: null, confidence: "low", finding: "Evidence gap", evidence_ids: [] });

/** Eight parallel structured calls sharing the cached prefix. Each returns as soon as it's done. */
export async function scoreAll(
  t: Tracker,
  o: { s: State; company: string; evidence: EvidenceItem[]; task: AiTask; signal?: AbortSignal; push: (e: FlowEvent) => void },
): Promise<ScoredDomain[]> {
  const ids = new Set(o.evidence.map((e) => e.id));
  const prefix = taxonomyPrefix(o.s, o.company);
  const list = evidenceList(o.evidence);
  const results = await Promise.all(
    DOMAIN_ORDER(o.s).map(async (d) => {
      let out: ScoredDomain;
      try {
        const v = await structuredCall(t, {
          task: o.task,
          system: [prefix, plain(section("diagnostic", "score", { company: o.company }))],
          messages: [{ role: "user", content: `Evidence list for ${o.company}:\n${list || "(no evidence)"}\n\nScore this domain: ${d.slug} (${d.label}).` }],
          max_tokens: 1200,
          effort: "low",
          signal: o.signal,
          schema: DomainScore,
          jsonSchema: DomainScoreJson,
          normalize: (raw) => lowerEnums(raw, SCORE_ENUMS),
          check: (v) => scoreIssues(v, ids, d.slug),
        });
        const valid = v.evidence_ids.filter((id) => ids.has(id));
        out = v.score != null && !valid.length ? evidenceGap(d.slug) : { ...v, domain: d.slug, evidence_ids: valid };
      } catch (err) {
        if (!(err instanceof ValidationFailure)) throw err;
        out = evidenceGap(d.slug); // an invalid domain becomes "Evidence gap"
      }
      o.push({ type: "score", ...out });
      return out;
    }),
  );
  return results;
}

export async function synthesize(
  t: Tracker,
  o: { s: State; company: string; evidence: EvidenceItem[]; scores: ScoredDomain[]; task: AiTask; signal?: AbortSignal },
): Promise<Synthesis> {
  const ctx = {
    evidenceIds: new Set(o.evidence.map((e) => e.id)),
    programIds: new Set(o.s.programs.map((p) => p.id)),
    lessonIds: new Set(o.s.lessons.map((l) => l.id)),
    scores: new Map(o.scores.map((x) => [x.domain, x.score])),
  };
  const scoresText = o.scores.map((x) => `- ${x.domain}: ${x.score ?? "null"} (${x.confidence}) ${x.finding} [${x.evidence_ids.join(", ")}]`).join("\n");
  let v;
  try {
    v = await structuredCall(t, {
      task: o.task,
      system: [taxonomyPrefix(o.s, o.company), plain(section("diagnostic", "synthesis", { company: o.company }))],
      messages: [{ role: "user", content: `Company: ${o.company}\n\nDomain scores:\n${scoresText}\n\nEvidence list:\n${evidenceList(o.evidence)}` }],
      max_tokens: 2500,
      effort: "medium",
      signal: o.signal,
      schema: SynthesisSchema,
      jsonSchema: SynthesisJson,
      normalize: (raw) => lowerEnums(raw, SYNTH_ENUMS),
      check: (x) => synthesisIssues(x, ctx),
    });
  } catch (err) {
    if (err instanceof ValidationFailure) throw err;
    throw err;
  }
  // drop offending items rather than fail
  return {
    binding_domain: v.binding_domain,
    binding_statement: v.binding_statement,
    rationale: v.rationale,
    evidence_ids: v.evidence_ids.filter((id) => ctx.evidenceIds.has(id)),
    questions: v.questions,
    program_ids: v.program_ids.filter((id) => ctx.programIds.has(id)).slice(0, 2),
    lesson_ids: v.lesson_ids.filter((id) => ctx.lessonIds.has(id)),
  };
}

/** Web tools by model generation (docs: Haiku uses the basic search tool). */
/**
 * The basic web tool versions, on purpose. The `_20260209` versions filter results through code
 * execution before the model sees them: in a live F2 run that spent the whole 75 s cutoff in code
 * execution, fetched nothing and wrote no cited text, so no evidence could be extracted. The basic
 * versions put results straight into context, where `web_search_result_location` / `char_location`
 * citations point at them.
 */
export function webSearchTool(_model: string, maxUses: number): BetaToolUnion {
  return { type: "web_search_20250305", name: "web_search", max_uses: maxUses } as unknown as BetaToolUnion;
}
export function webFetchTool(maxUses: number): BetaToolUnion {
  return { type: "web_fetch_20250910", name: "web_fetch", max_uses: maxUses, citations: { enabled: true }, max_content_tokens: 20000 } as unknown as BetaToolUnion;
}

/** Synthesise the visible event sequence for a stored F1/F2 result (replay of a cached run). */
export function eventsForResult(r: { sources?: { url: string; title: string }[]; evidence: EvidenceItem[]; scores: ScoredDomain[] }, keys: { pre: string[]; evidence: string; score: string; post: string[] }): FlowEvent[] {
  const ev: FlowEvent[] = [];
  for (const k of keys.pre) ev.push({ type: "step", key: k, state: "running" }, { type: "step", key: k, state: "done" });
  for (const s of r.sources ?? []) ev.push({ type: "source", url: s.url, title: s.title });
  ev.push({ type: "step", key: keys.evidence, state: "running" });
  for (const e of r.evidence) ev.push({ type: "evidence", id: e.id, claim: e.claim, cited_text: e.cited_text, ...(e.url ? { url: e.url } : {}), title: e.title });
  ev.push({ type: "step", key: keys.evidence, state: "done", detail: `${r.evidence.length} items` });
  ev.push({ type: "step", key: keys.score, state: "running" });
  for (const s of r.scores) ev.push({ type: "score", ...s });
  ev.push({ type: "step", key: keys.score, state: "done" });
  for (const k of keys.post) ev.push({ type: "step", key: k, state: "running" }, { type: "step", key: k, state: "done" });
  return ev;
}
