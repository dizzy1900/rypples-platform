import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  normaliseWeights,
  scoreMarkets,
  setWeight,
  whyTopThree,
  labelToScore,
} from "@/lib/geo/score";
import { marketsFileSchema, type Market } from "@/lib/geo/schema";
import { getMarkets } from "@/lib/geo";
import raw from "@/data/geo/markets.json";

function mk(iso3: string, basin: number, solar: number, kind: "pilot" | "precedent" | null = null, proj = "High"): Market {
  return {
    iso3,
    country: iso3,
    site: { name: iso3 + " site", lat: 0, lon: 0 },
    water_stress: {
      basin_score: basin,
      basin_label: "High",
      country_score: basin,
      country_label: "High",
      projected_2030_label: proj,
    },
    solar_kwh_m2_day: solar,
    presence: { kind, label: kind ? "x" : null, source_id: kind ? "s" : null },
    rypples_coverage: false,
  };
}

const fixture = [
  mk("AAA", 5, 4, null, "Low"),
  mk("BBB", 3, 6, null, "Extremely high"),
  mk("CCC", 4, 5, "pilot"),
  mk("DDD", 1, 7),
];

describe("weights", () => {
  it("normalises to 100", () => {
    const n = normaliseWeights({ water: 1, solar: 1, presence: 2 });
    expect(n.water + n.solar + n.presence).toBeCloseTo(100);
    expect(n.presence).toBeCloseTo(50);
  });
  it("falls back to equal weights when all zero", () => {
    const n = normaliseWeights({ water: 0, solar: 0, presence: 0 });
    expect(n.water).toBeCloseTo(100 / 3);
  });
  it("setWeight shares the remainder proportionally", () => {
    const w = setWeight(DEFAULT_WEIGHTS, "water", 80);
    expect(w.water).toBe(80);
    expect(w.solar).toBeCloseTo(12);
    expect(w.presence).toBeCloseTo(8);
    expect(w.water + w.solar + w.presence).toBeCloseTo(100);
  });
});

describe("scoreMarkets", () => {
  it("is deterministic and ranked", () => {
    const a = scoreMarkets(fixture);
    const b = scoreMarkets([...fixture].reverse());
    expect(a.map((r) => r.market.iso3)).toEqual(b.map((r) => r.market.iso3));
    expect(a.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    // CCC: 0.5*0.8 + 0.3*(1/3) + 0.2 = 0.7 ; AAA: 0.5 ; BBB: 0.3+0.3*(2/3)=0.5? -> 0.5*0.6+0.3*0.667=0.5
    expect(a[0].market.iso3).toBe("CCC");
    expect(a[0].composite).toBeCloseTo(0.5 * 0.8 + 0.3 / 3 + 0.2);
    for (const r of a) {
      expect(r.components.water + r.components.solar + r.components.presence).toBeCloseTo(r.composite);
      expect(r.composite).toBeGreaterThanOrEqual(0);
      expect(r.composite).toBeLessThanOrEqual(1);
    }
  });
  it("breaks ties by water stress then solar", () => {
    // Water-only weights: equal water score, so the higher solar market ranks first.
    const lo = mk("LOW", 0, 4);
    const hi = mk("HIG", 0, 6);
    const res = scoreMarkets([mk("P", 3, 5), mk("P2", 3, 5.5), lo, hi], { water: 100, solar: 0, presence: 0 });
    expect(res.filter((r) => r.market.water_stress.basin_score === 3).map((r) => r.market.iso3)).toEqual(["P2", "P"]);
    // Solar-only weights: equal solar, so the higher water stress market ranks first.
    const res2 = scoreMarkets([mk("S1", 2, 5), mk("S2", 4, 5)], { water: 0, solar: 100, presence: 0 });
    expect(res2.map((r) => r.market.iso3)).toEqual(["S2", "S1"]);
    // Composite tie across indicators: water 0.5 vs solar 0.5 at equal weights -> higher water first.
    const t = scoreMarkets([mk("W", 5, 4), mk("V", 0, 6), mk("M", 0, 4)], { water: 50, solar: 50, presence: 0 });
    expect(t.slice(0, 2).map((r) => r.market.iso3)).toEqual(["W", "V"]);
  });
  it("2030 toggle swaps the indicator", () => {
    const base = scoreMarkets(fixture);
    const proj = scoreMarkets(fixture, DEFAULT_WEIGHTS, { use2030: true });
    const aBase = base.find((r) => r.market.iso3 === "AAA")!;
    const aProj = proj.find((r) => r.market.iso3 === "AAA")!;
    expect(aBase.water_score).toBe(5);
    expect(aProj.water_score).toBe(labelToScore("Low"));
    expect(aProj.composite).toBeLessThan(aBase.composite);
    const bProj = proj.find((r) => r.market.iso3 === "BBB")!;
    expect(bProj.water_score).toBe(4.5);
  });
  it("why text uses the template", () => {
    const t = whyTopThree(scoreMarkets(fixture));
    expect(t).toHaveLength(3);
    expect(t[0]).toMatch(/^CCC: basin water stress high \(4\.0\/5\) and 5\.0 kWh\/m²\/day of sun\./);
  });
});

describe("markets.json", () => {
  it("parses against the schema", () => {
    expect(() => marketsFileSchema.parse(raw)).not.toThrow();
    const f = getMarkets();
    expect(f.markets).toHaveLength(23);
    expect(f.datasets.map((d) => d.id)).toContain("aqueduct40");
  });
  it("records top three at default weights and at water=80", () => {
    const { markets } = getMarkets();
    const def = scoreMarkets(markets).slice(0, 3).map((r) => r.market.iso3);
    const heavy = scoreMarkets(markets, setWeight(DEFAULT_WEIGHTS, "water", 80)).slice(0, 3).map((r) => r.market.iso3);
    console.log("top3 default:", def.join(","), "| top3 water=80:", heavy.join(","));
    expect(def).toEqual(["ARE", "JOR", "EGY"]);
    // Finding: Aqueduct baseline water stress saturates at 5/5 for most candidate basins, so a heavier water
    // weight lifts them all equally and the top three do not change. Weight still moves the scores.
    expect(heavy).toEqual(def);
    const a = scoreMarkets(markets)[0].composite;
    const b = scoreMarkets(markets, setWeight(DEFAULT_WEIGHTS, "water", 80))[0].composite;
    expect(b).toBeGreaterThan(a);
  });
  it("top three differ when presence is removed", () => {
    const { markets } = getMarkets();
    const def = scoreMarkets(markets).slice(0, 3).map((r) => r.market.iso3);
    const noPresence = scoreMarkets(markets, setWeight(DEFAULT_WEIGHTS, "presence", 0)).slice(0, 3).map((r) => r.market.iso3);
    expect(noPresence).not.toEqual(def);
  });
});
