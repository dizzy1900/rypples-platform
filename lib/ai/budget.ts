/**
 * Live vs cached mode, the spending cap, the circuit breaker and the priority budget
 * (docs/10-security-cost-ops.md §1, §2, §4). `getMode()` runs before every flow; its result is
 * the first SSE event.
 */
import "server-only";
import { env } from "@/lib/env";
import { getKv } from "@/lib/redis";
import { priceFor, WEB_SEARCH_USD_PER_REQUEST } from "@/config/pricing";
import type { FlowName } from "./sse";

export type BudgetConfig = {
  liveAi: boolean;
  hasKey: boolean;
  dailyUsd: number;
  f2DailyRuns: number;
  priorityUsd: number;
};

let override: Partial<BudgetConfig> | null = null;
/** Tests only. */
export function __setBudgetConfig(c: Partial<BudgetConfig> | null) {
  override = c;
}

export function budgetConfig(): BudgetConfig {
  const e = env();
  return {
    liveAi: e.LIVE_AI === "on",
    hasKey: !!e.ANTHROPIC_API_KEY,
    dailyUsd: e.AI_DAILY_BUDGET_USD,
    f2DailyRuns: e.AI_F2_DAILY_RUNS,
    priorityUsd: e.AI_PRIORITY_BUDGET_USD,
    ...override,
  };
}

export const SOFT_LIMIT = 0.8;
export const CIRCUIT = { errors: 5, windowMs: 2 * 60_000, openSec: 10 * 60 };

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const secondsToMidnightUtc = (d = new Date()) => {
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(60, Math.ceil((end - d.getTime()) / 1000)) + 3600; // keep a little past midnight for reporting
};

export const keys = {
  spend: (d = day()) => `spend:${d}`,
  spendFlow: (flow: string, d = day()) => `spend:flow:${flow}:${d}`,
  priority: (d = day()) => `spend:priority:${d}`,
  f2Runs: (d = day()) => `runs:f2:${d}`,
  runsFlow: (flow: string, d = day()) => `runs:flow:${flow}:${d}`,
  circuitErrors: "circuit:errors",
  circuitOpen: "circuit:open",
  errors: "errors:last",
};

export type ModeCtx = { priority: boolean; runAgain?: boolean };
export type ModeDecision = {
  mode: "live" | "cached";
  reason?: "disabled" | "budget" | "error";
  /** ≥ 80% of the daily cap: F2 "Run again" is disabled. */
  soft: boolean;
  /** live because of the priority cookie after the public cap */
  viaPriority: boolean;
};

export async function spendToday() {
  const kv = getKv();
  const [pub, pri] = await Promise.all([kv.get(keys.spend()), kv.get(keys.priority())]);
  return { public: Number(pub ?? 0), priority: Number(pri ?? 0) };
}

export async function circuitOpen(): Promise<boolean> {
  return (await getKv().get(keys.circuitOpen)) === "1";
}

export async function getMode(flow: FlowName, ctx: ModeCtx): Promise<ModeDecision> {
  const c = budgetConfig();
  if (!c.liveAi || !c.hasKey) return { mode: "cached", reason: "disabled", soft: false, viaPriority: false };
  if (await circuitOpen()) return { mode: "cached", reason: "error", soft: false, viaPriority: false };
  const spend = await spendToday();
  const soft = spend.public >= c.dailyUsd * SOFT_LIMIT;
  const overPublic = spend.public >= c.dailyUsd;
  let f2Over = false;
  if (flow === "any-company") f2Over = Number((await getKv().get(keys.f2Runs())) ?? 0) >= c.f2DailyRuns;
  if (overPublic || f2Over) {
    if (ctx.priority && spend.priority < c.priorityUsd) return { mode: "live", soft: false, viaPriority: true };
    return { mode: "cached", reason: "budget", soft: true, viaPriority: false };
  }
  return { mode: "live", soft: soft && !ctx.priority, viaPriority: false };
}

export type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null } | null;
};

/** Estimated USD cost of one call from its `usage` (docs/10 §2). */
export function estimateCost(model: string, usage: UsageLike, fallbackModel?: string): number {
  const p = priceFor(model) ?? (fallbackModel ? priceFor(fallbackModel) : null);
  if (!p) throw new Error(`No price configured for ${model} (config/pricing.ts)`);
  const M = 1_000_000;
  const w1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const w5m = usage.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (usage.cache_creation_input_tokens ?? 0) - w1h);
  const tokens =
    ((usage.input_tokens ?? 0) * p.input +
      (usage.output_tokens ?? 0) * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      w5m * p.cacheWrite5m +
      w1h * p.cacheWrite1h) /
    M;
  return tokens + (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD_PER_REQUEST;
}

/** Record spend after each call (atomic increments). Priority sessions past the public cap draw on their own counter. */
export async function recordSpend(flow: FlowName, usd: number, opts: { viaPriority: boolean }) {
  if (!(usd > 0)) return;
  const kv = getKv();
  const ttl = secondsToMidnightUtc() + 6 * 86400;
  await Promise.all([
    kv.incrFloat(opts.viaPriority ? keys.priority() : keys.spend(), usd, ttl),
    kv.incrFloat(keys.spendFlow(flow), usd, ttl),
  ]);
}

export async function recordRun(flow: FlowName) {
  const kv = getKv();
  const ttl = secondsToMidnightUtc() + 6 * 86400;
  await kv.incrFloat(keys.runsFlow(flow), 1, ttl);
  if (flow === "any-company") await kv.incrFloat(keys.f2Runs(), 1, ttl);
}

/** Circuit breaker: 5 consecutive API errors within 2 minutes → cached for 10 minutes. */
export async function recordApiError(flow: string, message: string) {
  const kv = getKv();
  const now = Date.now();
  const n = await kv.windowHit(keys.circuitErrors, now, CIRCUIT.windowMs, `${now}-${Math.random().toString(36).slice(2, 8)}`);
  await kv.pushCapped(keys.errors, JSON.stringify({ at: new Date(now).toISOString(), flow, message: message.slice(0, 300) }), 20, 7 * 86400);
  if (n >= CIRCUIT.errors) await kv.set(keys.circuitOpen, "1", CIRCUIT.openSec);
}

export async function recordApiSuccess() {
  await getKv().del(keys.circuitErrors);
}

export async function lastErrors(n = 20): Promise<{ at: string; flow: string; message: string }[]> {
  return (await getKv().list(keys.errors, n)).map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return { at: "", flow: "", message: s };
    }
  });
}

/** Snapshot for /os/_status and S5b ("Run again" availability). */
export async function budgetStatus(ctx: ModeCtx = { priority: false }) {
  const c = budgetConfig();
  const kv = getKv();
  const flows: FlowName[] = ["diagnostic", "any-company", "captain", "lesson-match", "board-pack", "shareholder-update", "day-one"];
  const [spend, open, perFlow] = await Promise.all([
    spendToday(),
    circuitOpen(),
    Promise.all(
      flows.map(async (f) => ({
        flow: f,
        runs: Number((await kv.get(keys.runsFlow(f))) ?? 0),
        usd: Number((await kv.get(keys.spendFlow(f))) ?? 0),
      })),
    ),
  ]);
  const mode = await getMode("any-company", ctx);
  return {
    date: day(),
    config: c,
    spend,
    circuitOpen: open,
    perFlow,
    mode,
    store: kv.kind,
    runAgainAllowed: mode.mode === "live" && !mode.soft,
  };
}
