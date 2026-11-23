/**
 * F1 · Diagnostic on a source pack (docs/07-ai.md F1). Evidence call with document citations,
 * eight parallel structured scoring calls, one synthesis call; persisted as `diagnostic.proposed`.
 */
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import type { BetaRequestDocumentBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { appendEvent, getState, type State } from "@/lib/data";
import type { Diagnostic, DimensionScore, Evidence } from "@/lib/domain/schemas";
import { callModel, modelFor } from "../client";
import { section } from "../prompts";
import { DiagnosticInput } from "../schemas/diagnostic";
import { documentCitations, EvidenceCollector, snapshotBody, type PackDoc } from "../evidence";
import { precomputed } from "../precomputed";
import { replay } from "../replay";
import { withChannel } from "../stream";
import type { FlowEvent } from "../sse";
import type { DiagnosticResult, EvidenceItem, ScoredDomain, Synthesis } from "../types";
import { FALLBACK_MESSAGE, type FallbackReason, type FlowDef, type FlowRun } from "../runner";
import { scoreAll, synthesize, taxonomyPrefix } from "./shared";

type Input = { companyId: string };

async function loadPack(s: State, companyId: string): Promise<(PackDoc & { body: string })[]> {
  const out: (PackDoc & { body: string })[] = [];
  for (const d of s.documents.filter((x) => x.company_id === companyId)) {
    const src = s.sources.find((x) => x.id === d.source_id);
    if (!src?.snapshot_path) continue;
    try {
      const md = await fs.readFile(path.join(process.cwd(), src.snapshot_path), "utf8");
      out.push({ source_id: src.id, title: src.title, url: src.url, body: snapshotBody(md) });
    } catch {
      /* snapshot not captured yet */
    }
  }
  return out;
}

/** Write the proposed diagnostic (session event) and return the result payload. */
export async function persistDiagnostic(
  run: FlowRun<Input>,
  r: { company_id: string; scores: ScoredDomain[]; evidence: EvidenceItem[]; synthesis: Synthesis },
  o: { replayed: boolean; model: string | null },
): Promise<DiagnosticResult> {
  const id = `diag-${ulid().toLowerCase()}`;
  const diagnostic: Diagnostic = {
    id,
    firm_id: "rypples",
    company_id: r.company_id,
    run_id: run.runId,
    kind: "board_pack",
    status: "proposed",
    binding_domain_id: r.synthesis.binding_domain,
    binding_statement: r.synthesis.binding_statement,
    binding_detail: r.synthesis.rationale,
    questions: r.synthesis.questions,
    program_ids: r.synthesis.program_ids,
    lesson_ids: r.synthesis.lesson_ids,
    confirmed_by: null,
    confirmed_at: null,
    confirmed_label: null,
    prompt_version: run.meta.promptVersion,
    model: o.model,
    provenance: "generated",
  };
  const scores: DimensionScore[] = r.scores.map((x) => ({
    id: `${id}-${x.domain}`,
    diagnostic_id: id,
    domain_id: x.domain,
    score: x.score,
    confidence: x.confidence,
    finding: x.finding,
    evidence_ids: x.evidence_ids,
    source_ids: [...new Set(x.evidence_ids.map((eid) => r.evidence.find((e) => e.id === eid)?.location?.source_id).filter((v): v is string => !!v))],
    is_binding: x.domain === r.synthesis.binding_domain,
    note: null,
  }));
  const evidence: Evidence[] = r.evidence.map((e) => ({
    id: e.id,
    firm_id: "rypples",
    company_id: r.company_id,
    run_id: run.runId,
    source_id: e.location?.source_id ?? null,
    document_id: null,
    url: e.url,
    title: e.title,
    cited_text: e.cited_text.slice(0, 400),
    claim: e.claim,
    location: e.location ? { source_id: e.location.source_id, start: e.location.start, end: e.location.end } : null,
    provenance: "generated",
  }));
  await appendEvent({
    sessionId: run.sessionId,
    actor: "jerome",
    type: "diagnostic.proposed",
    entityType: "diagnostic",
    entityId: id,
    payload: {
      company_id: r.company_id,
      diagnostic: diagnostic as unknown as Record<string, unknown>,
      scores: scores as unknown as Record<string, unknown>[],
      evidence: evidence as unknown as Record<string, unknown>[],
      run_id: run.runId,
    },
  });
  return { diagnostic_id: id, company_id: r.company_id, scores: r.scores, evidence: r.evidence, synthesis: r.synthesis, replayed: o.replayed };
}

async function* live(run: FlowRun<Input>): AsyncGenerator<FlowEvent> {
  run.meta.promptVersion = "diagnostic@v1";
  const s = await getState(run.sessionId);
  const company = s.companies.find((c) => c.id === run.input.companyId || c.slug === run.input.companyId);
  if (!company) throw new Error("Unknown company");
  yield { type: "step", key: "read", state: "running" };
  const docs = await loadPack(s, company.id);
  if (!docs.length) throw new Error("No source pack for this company");
  yield { type: "step", key: "read", state: "done", detail: `${docs.length} documents` };

  yield { type: "step", key: "extract", state: "running" };
  const col = new EvidenceCollector(`ev-${run.runId.slice(-6).toLowerCase()}`);
  const blocks: BetaRequestDocumentBlock[] = docs.map((d) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: d.body },
    title: d.title,
    citations: { enabled: true },
  }));
  const msg = await callModel(run.tracker, {
    task: "f1-evidence",
    system: [taxonomyPrefix(s, company.name)],
    messages: [{ role: "user", content: [...blocks, { type: "text", text: section("diagnostic", "evidence", { company: company.name }) }] }],
    max_tokens: 8000,
    effort: "medium",
    signal: run.signal,
  });
  const evidence = documentCitations(msg, docs, col);
  for (const e of evidence) yield { type: "evidence", id: e.id, claim: e.claim, cited_text: e.cited_text, ...(e.url ? { url: e.url } : {}), title: e.title };
  yield { type: "step", key: "extract", state: "done", detail: `${evidence.length} items` };
  yield { type: "step", key: "map", state: "running" };
  yield { type: "step", key: "map", state: "done", detail: "8 domains" };

  yield { type: "step", key: "score", state: "running" };
  const scores = yield* withChannel((push) => scoreAll(run.tracker, { s, company: company.name, evidence, task: "f1-score", signal: run.signal, push }));
  yield { type: "step", key: "score", state: "done" };

  yield { type: "step", key: "playbook", state: "running" };
  yield { type: "step", key: "binding", state: "running" };
  const synthesis = await synthesize(run.tracker, { s, company: company.name, evidence, scores, task: "f1-synthesis", signal: run.signal });
  yield { type: "step", key: "playbook", state: "done", detail: `${synthesis.lesson_ids.length} lesson${synthesis.lesson_ids.length === 1 ? "" : "s"}` };
  yield { type: "step", key: "binding", state: "done", detail: s.domains.find((d) => d.slug === synthesis.binding_domain)?.label };

  const result = await persistDiagnostic(run, { company_id: company.id, scores, evidence, synthesis }, { replayed: false, model: modelFor("f1-synthesis") });
  yield { type: "result", id: result.diagnostic_id, data: result };
}

async function* cachedRun(run: FlowRun<Input>, reason: FallbackReason): AsyncGenerator<FlowEvent> {
  const f = precomputed.f1;
  if (run.input.companyId !== f.company_id) {
    yield { type: "fallback", reason, replaying: false, message: "Live runs are paused for today." };
    return;
  }
  run.meta.precomputed = true;
  run.meta.promptVersion = f.prompt_version ?? "diagnostic@v1";
  yield { type: "fallback", reason, replaying: true, message: FALLBACK_MESSAGE[reason] };
  yield* replay(f.events, `f1:${run.runId}`);
  const result = await persistDiagnostic(run, f.result, { replayed: true, model: f.model });
  yield { type: "result", id: result.diagnostic_id, data: result };
}

export const diagnosticFlow: FlowDef<Input> = {
  flow: "diagnostic",
  input: DiagnosticInput,
  surface: () => "diagnostic",
  live,
  cached: cachedRun,
};

