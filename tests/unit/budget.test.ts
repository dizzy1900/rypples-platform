import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetKv, getKv } from "@/lib/redis";
import { __resetMemoryStore } from "@/lib/data/store";
import { getStore } from "@/lib/data";
import {
  __resetSpendCache,
  __setBudgetConfig,
  CIRCUIT,
  getMode,
  keys,
  recordApiError,
  recordApiSuccess,
  recordRun,
  recordSpend,
  spendToday,
  spendTotal,
} from "@/lib/ai/budget";

// A $15 lifetime cap with $5 kept for the priority link: public visitors stop at $10.
const CFG = { liveAi: true, hasKey: true, totalUsd: 15, priorityReserveUsd: 5, f2DailyRuns: 3 };

beforeEach(() => {
  __resetKv();
  __resetMemoryStore();
  __resetSpendCache();
  __setBudgetConfig(CFG);
});
afterEach(() => __setBudgetConfig(null));

describe("budget and mode (docs/10 §1)", () => {
  it("is cached with reason disabled when LIVE_AI is off or there is no key", async () => {
    __setBudgetConfig({ ...CFG, liveAi: false });
    expect(await getMode("diagnostic", { priority: false })).toMatchObject({ mode: "cached", reason: "disabled" });
    __setBudgetConfig({ ...CFG, hasKey: false });
    expect(await getMode("diagnostic", { priority: true })).toMatchObject({ mode: "cached", reason: "disabled" });
  });

  it("is live under the public share, soft at 80% of it, cached once it is used", async () => {
    expect(await getMode("captain", { priority: false })).toEqual({ mode: "live", soft: false, viaPriority: false });
    await recordSpend("captain", 8.1, { viaPriority: false });
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "live", soft: true });
    await recordSpend("captain", 2, { viaPriority: false });
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "cached", reason: "budget" });
  });

  it("lets the priority cookie use the reserve, and stops everyone at the total", async () => {
    await recordSpend("captain", 10, { viaPriority: false });
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "cached", reason: "budget" });
    expect(await getMode("captain", { priority: true })).toEqual({ mode: "live", soft: false, viaPriority: true });
    await recordSpend("captain", 5, { viaPriority: true });
    expect(await getMode("captain", { priority: true })).toMatchObject({ mode: "cached", reason: "budget" });
    expect(await spendToday()).toEqual({ public: 10, priority: 5 });
    expect(await spendTotal()).toBe(15);
  });

  it("is a lifetime total, not a daily one: spend recorded on earlier days still counts", async () => {
    await getKv().incrFloat(keys.spend("2026-11-01"), 9, 86400);
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "live" });
    await getKv().set(keys.total, "15");
    expect(await getMode("captain", { priority: true })).toMatchObject({ mode: "cached", reason: "budget" });
  });

  it("reads durable spend from agent_runs, so the cap holds across instances and scripts", async () => {
    const run = (id: string, usd: number) => ({
      id,
      firm_id: "rypples",
      flow: "diagnostic",
      input: { source: "precompute" },
      status: "ok" as const,
      started_at: "2026-11-23T09:00:00Z",
      finished_at: "2026-11-23T09:01:00Z",
      model: "claude-sonnet-5-5",
      prompt_version: null,
      usage: {},
      searches: 0,
      fetches: 0,
      est_cost_usd: usd,
      mode: "live" as const,
      session_id: null,
      ip_hash: null,
      error: null,
    });
    await getStore().putAgentRun(run("a", 6));
    await getStore().putAgentRun(run("b", 9));
    expect(await spendTotal()).toBe(15);
    expect(await getMode("captain", { priority: true })).toMatchObject({ mode: "cached", reason: "budget" });
  });

  it("caps F2 live runs per day independently of spend", async () => {
    for (let i = 0; i < CFG.f2DailyRuns; i++) await recordRun("any-company");
    expect(await getMode("any-company", { priority: false })).toMatchObject({ mode: "cached", reason: "budget" });
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "live" });
  });

  it("opens the circuit after 5 errors and stays cached", async () => {
    for (let i = 0; i < CIRCUIT.errors - 1; i++) await recordApiError("captain", "529 overloaded");
    expect(await getMode("captain", { priority: true })).toMatchObject({ mode: "live" });
    await recordApiError("captain", "529 overloaded");
    expect(await getMode("captain", { priority: true })).toMatchObject({ mode: "cached", reason: "error" });
    expect(await getKv().get(keys.circuitOpen)).toBe("1");
  });

  it("a success resets the consecutive error count", async () => {
    for (let i = 0; i < CIRCUIT.errors - 1; i++) await recordApiError("captain", "500");
    await recordApiSuccess();
    await recordApiError("captain", "500");
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "live" });
  });

  it("ignores non-positive spend", async () => {
    await recordSpend("captain", 0, { viaPriority: false });
    await recordSpend("captain", Number.NaN, { viaPriority: false });
    expect(await spendToday()).toEqual({ public: 0, priority: 0 });
  });
});
