/**
 * F2 · Run on any ocean company (docs/07-ai.md F2). Cache → relevance check (search + structured)
 * → research (search + fetch, cut off at 75 s) → evidence → parallel scoring → synthesis →
 * deterministic insufficient-evidence rule → shared any_company_runs cache.
 */
import "server-only";
import type { BetaContentBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { getSeedState, getStore } from "@/lib/data";
import { callModel, modelFor, plain, structuredCall, textOf } from "../client";
import { section, tone } from "../prompts";
import { AnyCompanyInput, insufficientReasons, normalizeRelevance, RelevanceCheck, RelevanceCheckJson } from "../schemas/any-company";
import { distinctSourceDomains, EvidenceCollector, isSocial, nameKey, normaliseQuery, registrableDomain, slugify, sourcesIn, webCitations } from "../evidence";
import { reviewedF2 } from "../precomputed";
import { replay } from "../replay";
import { withChannel } from "../stream";
import type { FlowEvent } from "../sse";
import type { AnyCompanyResult, EvidenceItem } from "../types";
import { FALLBACK_MESSAGE, type FallbackReason, type FlowDef, type FlowRun } from "../runner";
import { eventsForResult, scoreAll, synthesize, webFetchTool, webSearchTool } from "./shared";

type Input = { query: string; runAgain?: boolean };
const RESEARCH_CUTOFF_MS = 75_000;
/** 7-day freshness (same value as lib/ai/runs.ts, which is page-only). */
const F2_FRESH_MS = 7 * 24 * 3600_000;
export const PAUSED = "Live runs are paused for today. You can open any recent run.";

async function findCached(q: ReturnType<typeof normaliseQuery>): Promise<AnyCompanyResult | null> {
  const store = getStore();
  const keys = [q.key, nameKey(q.raw)];
  for (const k of keys) {
    const row = await store.getAnyCompanyRun({ domain: k });
    if (row?.result) return row.result as AnyCompanyResult;
  }
  return reviewedF2([q.nameSlug, slugify(q.raw)]);
}

const fresh = (r: AnyCompanyResult) => Date.now() - new Date(r.created_at).getTime() < F2_FRESH_MS;

const replayEvents = (r: AnyCompanyResult): FlowEvent[] =>
  r.status === "ok" || r.status === "insufficient"
    ? eventsForResult(r, { pre: ["check", "search", "read"], evidence: "extract", score: "score", post: ["match"] })
    : [{ type: "step", key: "check", state: "running" }, { type: "step", key: "check", state: "done", detail: r.status }];

/**
 * One row per lookup key (the name typed, the company's domain…). The first row's id is the run id,
 * which the run page reads; the others get their own ids, because `id` is the table's primary key.
 */
async function persist(run: FlowRun<Input>, r: AnyCompanyResult, keys: string[]) {
  const store = getStore();
  const unique = [...new Set(keys.filter(Boolean))];
  for (const [i, k] of unique.entries()) {
    const id = i === 0 ? r.run_id : `${r.run_id}~${k}`;
    await store.putAnyCompanyRun({ id, domain: k, display_name: r.identity.name, status: r.status, result: r, run_id: run.runId, created_at: r.created_at });
  }
}

/** Fresh cache hit: answer immediately (unless "Run again"). */
async function pre(run: FlowRun<Input>) {
  if (run.input.runAgain) return null;
  const q = normaliseQuery(run.input.query);
  const hit = await findCached(q);
  if (!hit || !fresh(hit) || !["ok", "insufficient", "declined"].includes(hit.status)) return null;
  return (async function* (): AsyncGenerator<FlowEvent> {
    yield { type: "result", id: hit.run_id, data: hit };
  })();
}

async function* live(run: FlowRun<Input>): AsyncGenerator<FlowEvent> {
  run.meta.promptVersion = "any-company@v1";
  if (run.input.runAgain && run.decision.soft) {
    // ≥ 80% of the public share of the total cap: "Run again" replays instead of spending
    yield* cachedRun(run, "budget");
    return;
  }
  const q = normaliseQuery(run.input.query);
  const s = getSeedState();
  const t = run.tracker;
  const created_at = new Date().toISOString();
  const base = (over: Partial<AnyCompanyResult>): AnyCompanyResult => ({
    run_id: run.runId,
    status: "ok",
    identity: { name: q.display, website: q.isUrl ? `https://${q.domain}` : null, description: "", vertical: null, reason: "" },
    candidates: [],
    sources: [],
    scores: [],
    evidence: [],
    synthesis: null,
    created_at,
    reviewed: false,
    ...over,
  });

  // Step 1 · identify and check relevance
  yield { type: "step", key: "check", state: "running" };
  const idMsg = await callModel(t, {
    task: "f2-relevance",
    system: [plain(`${tone()}\n\n${section("any-company", "relevance")}`)],
    messages: [{ role: "user", content: `Company: ${q.raw}${q.isUrl ? `\nWebsite: https://${q.domain}` : ""}` }],
    tools: [webSearchTool(modelFor("f2-relevance"), 2)],
    max_tokens: 1200,
    signal: run.signal,
  });
  const rel = await structuredCall(t, {
    task: "f2-relevance",
    system: [plain(section("any-company", "relevance_structured"))],
    messages: [{ role: "user", content: `Query: ${q.raw}\n\nIdentification notes:\n${textOf(idMsg)}` }],
    max_tokens: 800,
    signal: run.signal,
    schema: RelevanceCheck,
    jsonSchema: RelevanceCheckJson,
    normalize: normalizeRelevance,
  });
  const website = rel.website ? (/^https?:\/\//.test(rel.website) ? rel.website : `https://${rel.website}`) : q.isUrl ? `https://${q.domain}` : null;
  const identity = { name: rel.name || q.display, website, description: rel.description, vertical: rel.vertical, reason: rel.reason };
  yield { type: "step", key: "check", state: "done", detail: rel.status === "ok" ? identity.name : rel.status.replace("_", " ") };
  const domainKey = website ? registrableDomain(website) : null;
  if (rel.status !== "ok") {
    const r = base({ status: rel.status, identity, candidates: rel.status === "ambiguous" ? rel.candidates : [] });
    await persist(run, r, rel.status === "declined" ? [nameKey(q.raw), nameKey(identity.name), domainKey ?? ""] : [nameKey(q.raw)]);
    yield { type: "result", id: r.run_id, data: r };
    return;
  }

  // Step 2 · research, cut off at 75 s
  yield { type: "step", key: "search", state: "running" };
  const collected: BetaContentBlock[] = [];
  const sources: { url: string; title: string }[] = [];
  const cutoff = new AbortController();
  const timer = setTimeout(() => cutoff.abort(), RESEARCH_CUTOFF_MS);
  const onAbort = () => cutoff.abort();
  run.signal.addEventListener("abort", onAbort);
  const research = yield* withChannel(async (push) => {
    let readStarted = false;
    try {
      const msg = await callModel(t, {
        task: "f2-research",
        system: [plain(`${tone()}\n\n${section("any-company", "research", { name: identity.name, website: website ?? "(no website found)" })}`)],
        messages: [{ role: "user", content: `Research ${identity.name}${website ? ` (${website})` : ""}. ${identity.description}` }],
        tools: [webSearchTool(modelFor("f2-research"), 5), webFetchTool(5)],
        max_tokens: 12000,
        effort: "medium",
        signal: cutoff.signal,
        onBlock: (b) => {
          collected.push(b);
          for (const src of sourcesIn(b)) {
            if (sources.some((x) => x.url === src.url)) continue;
            sources.push(src);
            push({ type: "source", url: src.url, title: src.title });
          }
          if (b.type === "web_fetch_tool_result" && !readStarted) {
            readStarted = true;
            push({ type: "step", key: "search", state: "done", detail: `${sources.length} found` });
            push({ type: "step", key: "read", state: "running" });
          }
        },
      });
      return { content: msg.content as BetaContentBlock[], cut: false, readStarted };
    } catch (err) {
      if (run.signal.aborted || !cutoff.signal.aborted) throw err;
      return { content: collected, cut: true, readStarted }; // score what was collected
    } finally {
      clearTimeout(timer);
      run.signal.removeEventListener("abort", onAbort);
    }
  });
  if (!research.readStarted) {
    yield { type: "step", key: "search", state: "done", detail: `${sources.length} found` };
    yield { type: "step", key: "read", state: "running" };
  }
  yield { type: "step", key: "read", state: "done", detail: research.cut ? "cut off at 75 seconds" : `${sources.length} sources` };

  yield { type: "step", key: "extract", state: "running" };
  const col = new EvidenceCollector(`ev-${run.runId.slice(-6).toLowerCase()}`);
  const evidence: EvidenceItem[] = webCitations(research.content, col).filter((e) => !isSocial(e.url));
  for (const e of evidence) yield { type: "evidence", id: e.id, claim: e.claim, cited_text: e.cited_text, ...(e.url ? { url: e.url } : {}), title: e.title };
  yield { type: "step", key: "extract", state: "done", detail: `${evidence.length} items` };

  // Step 3 · score and synthesise
  yield { type: "step", key: "score", state: "running" };
  const scores = yield* withChannel((push) => scoreAll(t, { s, company: identity.name, evidence, task: "f2-score", signal: run.signal, push }));
  yield { type: "step", key: "score", state: "done" };
  yield { type: "step", key: "match", state: "running" };
  const synthesis = await synthesize(t, { s, company: identity.name, evidence, scores, task: "f2-synthesis", signal: run.signal });
  const bindingEvidence = scores.find((x) => x.domain === synthesis.binding_domain)?.evidence_ids.length ?? 0;
  const reasons = insufficientReasons({ evidenceCount: evidence.length, sourceDomains: distinctSourceDomains(evidence), bindingEvidence });
  yield { type: "step", key: "match", state: "done", detail: reasons.length ? "insufficient evidence" : `${synthesis.program_ids.length} programs` };

  const r = base({
    status: reasons.length ? "insufficient" : "ok",
    identity,
    sources,
    scores,
    evidence,
    synthesis: reasons.length ? { ...synthesis, binding_domain: null, binding_statement: null, rationale: `Not enough public evidence to propose a binding constraint: ${reasons.join("; ")}.` } : synthesis,
  });
  await persist(run, r, [domainKey ?? "", q.key, nameKey(identity.name)]);
  yield { type: "result", id: r.run_id, data: r };
}

async function* cachedRun(run: FlowRun<Input>, reason: FallbackReason): AsyncGenerator<FlowEvent> {
  const q = normaliseQuery(run.input.query);
  const hit = await findCached(q);
  if (!hit) {
    yield { type: "fallback", reason, replaying: false, message: PAUSED };
    return;
  }
  run.meta.precomputed = true;
  yield { type: "fallback", reason, replaying: true, message: FALLBACK_MESSAGE[reason] };
  yield* replay(replayEvents(hit), `f2:${hit.run_id}`);
  yield { type: "result", id: hit.run_id, data: hit };
}

export const anyCompanyFlow: FlowDef<Input> = {
  flow: "any-company",
  input: AnyCompanyInput,
  surface: (i) => (i.runAgain ? "f2-again" : "f2-new"),
  runAgain: (i) => !!i.runAgain,
  pre,
  live,
  cached: cachedRun,
};
