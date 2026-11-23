/**
 * Shared flow runner (docs/07-ai.md §3, docs/10-security-cost-ops.md §1-§5).
 * Every flow route: parse and validate input → rate limit → getMode() → first SSE event `mode` →
 * live run (or cached / replay) → agent_runs row. A failed live run falls back to the cached path
 * with `fallback {reason: "error"}`. A rate-limit hit never becomes a raw 429: it is a `fallback`
 * with reason `rate_limit`.
 */
import "server-only";
import { ulid } from "ulid";
import type { z } from "zod";
import { getStore } from "@/lib/data";
import type { AgentRun } from "@/lib/data/store";
import { getMode, recordRun, type ModeDecision } from "./budget";
import { checkLimit, clientIp, hashIp, type Surface } from "./ratelimit";
import { newTracker, type Tracker } from "./client";
import { sseResponse } from "./stream";
import { cleanStrings } from "./schemas/common";
import type { FlowEvent, FlowName } from "./sse";

export type FallbackReason = "budget" | "error" | "disabled" | "rate_limit";

export type FlowRun<I> = {
  flow: FlowName;
  input: I;
  sessionId: string;
  priority: boolean;
  ipHash: string | null;
  runId: string;
  tracker: Tracker;
  signal: AbortSignal;
  decision: ModeDecision;
  /** set by flows: replayed precomputed content vs a deterministic cached computation */
  meta: {
    promptVersion: string | null;
    precomputed: boolean;
    status?: AgentRun["status"];
    error?: string | null;
    /** flows may leave raw material here for scripts/precompute.ts (e.g. Captain's raw text and tool calls) */
    capture?: Record<string, unknown>;
  };
};

export type FlowDef<I> = {
  flow: FlowName;
  input: z.ZodType<I>;
  surface: (input: I) => Surface;
  runAgain?: (input: I) => boolean;
  /** Called before mode selection; may short-circuit (e.g. F2 fresh cache hit). */
  pre?: (run: FlowRun<I>) => AsyncGenerator<FlowEvent> | null | Promise<AsyncGenerator<FlowEvent> | null>;
  live: (run: FlowRun<I>) => AsyncGenerator<FlowEvent>;
  cached: (run: FlowRun<I>, reason: FallbackReason) => AsyncGenerator<FlowEvent>;
};

const MAX_BODY = 16 * 1024;
// same names as lib/session.ts (not imported: that module pulls in next/headers)
const DEMO_COOKIE = "rp_demo";
const PRIORITY_COOKIE = "rp_priority";

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export const sessionFrom = (req: Request) => readCookie(req, DEMO_COOKIE) ?? "anonymous";
export function priorityFrom(req: Request): boolean {
  const token = process.env.DEMO_PRIORITY_TOKEN;
  return !!token && readCookie(req, PRIORITY_COOKIE) === token;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return { ok: false, res: json({ error: "Request too large" }, 413) };
  const text = await req.text();
  if (text.length > MAX_BODY) return { ok: false, res: json({ error: "Request too large" }, 413) };
  try {
    return { ok: true, body: cleanStrings(text ? JSON.parse(text) : {}) };
  } catch {
    return { ok: false, res: json({ error: "Invalid JSON" }, 400) };
  }
}

function log(level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) {
  if (process.env.VITEST) return;
  console[level === "info" ? "log" : level](JSON.stringify({ level, msg, ...extra }));
}

export async function handleFlow<I>(req: Request, def: FlowDef<I>): Promise<Response> {
  const parsedBody = await readJson(req);
  if (!parsedBody.ok) return parsedBody.res;
  const parsed = def.input.safeParse(parsedBody.body);
  if (!parsed.success) {
    return json({ error: "Invalid input", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
  }
  const input = parsed.data;
  const priority = priorityFrom(req);
  const ipHash = hashIp(clientIp(req));
  const run: FlowRun<I> = {
    flow: def.flow,
    input,
    sessionId: sessionFrom(req),
    priority,
    ipHash,
    runId: `run_${ulid()}`,
    tracker: newTracker(def.flow, false),
    signal: req.signal,
    decision: { mode: "cached", soft: false, viaPriority: false },
    meta: { promptVersion: null, precomputed: false },
  };
  const started = new Date().toISOString();
  let mode: AgentRun["mode"] = "cached";

  async function* gen(): AsyncGenerator<FlowEvent> {
    const pre = def.pre ? await def.pre(run) : null;
    if (pre) {
      yield { type: "mode", mode: "cached", reason: "cache" };
      run.meta.precomputed = true;
      yield* pre;
      return;
    }
    const limit = await checkLimit(def.surface(input), ipHash, { priority });
    if (!limit.ok) {
      log("warn", "rate limited", { flow: def.flow, windowMs: limit.windowMs });
      yield { type: "mode", mode: "cached", reason: "rate_limit" };
      yield* def.cached(run, "rate_limit");
      return;
    }
    run.decision = await getMode(def.flow, { priority, runAgain: def.runAgain?.(input) });
    run.tracker.viaPriority = run.decision.viaPriority;
    if (run.decision.mode === "cached") {
      yield { type: "mode", mode: "cached", reason: run.decision.reason };
      yield* def.cached(run, run.decision.reason ?? "disabled");
      return;
    }
    mode = "live";
    yield { type: "mode", mode: "live" };
    await recordRun(def.flow);
    // Buffer nothing: live events stream straight through. If the live run throws, fall back.
    let resultSent = false;
    try {
      for await (const e of def.live(run)) {
        if (e.type === "result") resultSent = true;
        yield e;
      }
      run.meta.status ??= "ok";
    } catch (err) {
      if (run.signal.aborted) throw err;
      run.meta.status = "fallback";
      run.meta.error = (err as Error).message?.slice(0, 500) ?? "error";
      log("error", "live flow failed", { flow: def.flow, run_id: run.runId, error: run.meta.error });
      if (resultSent) return;
      mode = "cached";
      yield* def.cached(run, "error");
    }
  }

  await getStore()
    .putAgentRun(agentRow(run, started, null, mode))
    .catch(() => undefined);
  return sseResponse(gen(), {
    onDone: async () => {
      const finalMode: AgentRun["mode"] = run.meta.precomputed ? "precomputed" : mode;
      await getStore()
        .putAgentRun(agentRow(run, started, new Date().toISOString(), finalMode))
        .catch(() => undefined);
      log("info", "flow done", { flow: def.flow, run_id: run.runId, mode: finalMode, cost_usd: run.tracker.cost_usd });
    },
  });
}

function agentRow<I>(run: FlowRun<I>, started: string, finished: string | null, mode: AgentRun["mode"]): AgentRun {
  const t = run.tracker;
  return {
    id: run.runId,
    firm_id: "rypples",
    flow: run.flow,
    input: run.input,
    status: finished ? (run.meta.status ?? (mode === "live" ? "ok" : "fallback")) : "running",
    started_at: started,
    finished_at: finished,
    model: t.models.join(",") || (mode === "precomputed" ? "precomputed" : null),
    prompt_version: run.meta.promptVersion,
    usage: {
      calls: t.calls,
      input_tokens: t.input_tokens,
      output_tokens: t.output_tokens,
      cache_read_input_tokens: t.cache_read_input_tokens,
      cache_creation_input_tokens: t.cache_creation_input_tokens,
      via_priority: t.viaPriority,
    },
    searches: t.searches,
    fetches: t.fetches,
    est_cost_usd: Math.round(t.cost_usd * 10000) / 10000,
    mode,
    session_id: run.sessionId,
    ip_hash: run.ipHash,
    error: run.meta.error ?? null,
  };
}

/** Fallback copy (docs/10 §1). */
export const FALLBACK_MESSAGE: Record<FallbackReason, string> = {
  budget: "Live runs are paused for today. Replaying a recent run.",
  disabled: "Live AI is off in this demo. Replaying a recent run.",
  error: "Captain hit a problem. Replaying a recent run instead.",
  rate_limit: "You've run this a lot in the last hour. Replaying a recent run.",
};
