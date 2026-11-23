import { describe, expect, it } from "vitest";
import { PRICING, priceFor } from "@/config/pricing";
import { configuredModels } from "@/lib/ai/client";
import { estimateCost } from "@/lib/ai/budget";

describe("pricing config (docs/11 §1)", () => {
  it("prices every configured model", () => {
    const models = configuredModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    for (const m of models) expect(priceFor(m), `${m} has no row in config/pricing.ts`).not.toBeNull();
  });
  it("never configures claude-fable-5-2", () => {
    expect(configuredModels()).not.toContain("claude-fable-5-2");
    expect(Object.keys(PRICING)).not.toContain("claude-fable-5-2");
  });
  it("has positive prices with cache reads cheaper than input", () => {
    for (const [m, p] of Object.entries(PRICING)) {
      expect(p.input, m).toBeGreaterThan(0);
      expect(p.output, m).toBeGreaterThan(p.input);
      expect(p.cacheRead, m).toBeLessThan(p.input);
      expect(p.cacheWrite1h, m).toBeGreaterThan(p.cacheWrite5m);
    }
  });
  it("estimates cost from usage, including web searches", () => {
    const m = configuredModels()[0]!;
    const p = priceFor(m)!;
    const usd = estimateCost(m, { input_tokens: 1_000_000, output_tokens: 0, server_tool_use: { web_search_requests: 3 } });
    expect(usd).toBeCloseTo(p.input + 0.03, 6);
  });
  it("throws for an unpriced model rather than guessing", () => {
    expect(() => estimateCost("claude-unknown-1", { input_tokens: 10 })).toThrow(/No price/);
    expect(estimateCost("claude-unknown-1", { input_tokens: 0 }, configuredModels()[0])).toBe(0);
  });
});
