import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetKv, getKv } from "@/lib/redis";
import { __setBudgetConfig, CIRCUIT, getMode, keys, recordApiError, recordApiSuccess, recordRun, recordSpend, spendToday } from "@/lib/ai/budget";

const CFG = { liveAi: true, hasKey: true, dailyUsd: 10, f2DailyRuns: 3, priorityUsd: 5 };

beforeEach(() => {
  __resetKv();
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

  it("is live under the cap, soft at 80%, cached at 100%", async () => {
    expect(await getMode("captain", { priority: false })).toEqual({ mode: "live", soft: false, viaPriority: false });
    await recordSpend("captain", 8.1, { viaPriority: false });
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "live", soft: true });
    await recordSpend("captain", 2, { viaPriority: false });
    expect(await getMode("captain", { priority: false })).toMatchObject({ mode: "cached", reason: "budget" });
  });

  it("lets the priority cookie bypass the public cap up to its own budget", async () => {
    await recordSpend("captain", 10, { viaPriority: false });
    expect(await getMode("captain", { priority: true })).toEqual({ mode: "live", soft: false, viaPriority: true });
    await recordSpend("captain", 5, { viaPriority: true });
    expect(await getMode("captain", { priority: true })).toMatchObject({ mode: "cached", reason: "budget" });
    expect(await spendToday()).toEqual({ public: 10, priority: 5 });
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
