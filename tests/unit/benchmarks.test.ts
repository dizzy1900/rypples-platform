import { describe, expect, it } from "vitest";
import { getSeed } from "@/lib/data/seed";
import { effectiveBenchmark, learningCurve, median, rollingMedian, sourceLabel, RYPPLES_CASE_THRESHOLD } from "@/lib/domain/benchmarks";
import type { ClearedCase } from "@/lib/domain/schemas";

const seed = getSeed();

const fixture = (days: number[]): ClearedCase[] =>
  days.map((d, i) => ({
    id: `fx-${i + 1}`,
    domain_id: "commercial",
    case_label: `Case ${i + 1}`,
    cleared_seq: i + 1,
    days: d,
    cleared_on: "2026-01-01",
    provenance: "illustrative",
  }));

describe("effectiveBenchmark", () => {
  it("uses the outside reference below eight Rypples cases", () => {
    for (const d of ["financing", "commercial", "operations", "technology", "regulatory", "people", "ai", "impact"] as const) {
      const own = seed.cleared_cases.filter((c) => c.domain_id === d).length;
      expect(own).toBeLessThan(RYPPLES_CASE_THRESHOLD);
      const b = effectiveBenchmark(d, seed.benchmarks, seed.cleared_cases);
      expect(b.source_kind).not.toBe("rypples");
      expect(b.days).toBe(seed.benchmarks.find((x) => x.domain_id === d)!.days);
      expect(b.cases).toBe(own);
    }
    expect(sourceLabel(effectiveBenchmark("commercial", seed.benchmarks, seed.cleared_cases).source_kind)).toBe("outside ref");
  });

  it("People has five cases of eight", () => {
    expect(effectiveBenchmark("people", seed.benchmarks, seed.cleared_cases).cases).toBe(5);
  });

  it("switches to the Rypples median at eight cases", () => {
    const days = [100, 90, 80, 70, 60, 50, 40, 30]; // median (60+70)/2 = 65
    const cases = [...seed.cleared_cases.filter((c) => c.domain_id !== "commercial"), ...fixture(days)];
    const b = effectiveBenchmark("commercial", seed.benchmarks, cases);
    expect(b.source_kind).toBe("rypples");
    expect(b.cases).toBe(8);
    expect(b.days).toBe(Math.round(median(days)));
    expect(b.days).toBe(65);
    expect(b.seeded_days).toBe(90);
    expect(sourceLabel(b.source_kind)).toBe("Rypples data");
  });

  it("stays on the outside reference at seven cases", () => {
    const cases = [...seed.cleared_cases.filter((c) => c.domain_id !== "commercial"), ...fixture([100, 90, 80, 70, 60, 50, 40])];
    expect(effectiveBenchmark("commercial", seed.benchmarks, cases).source_kind).toBe("outside");
  });
});

describe("rolling median", () => {
  it("uses a trailing window of four", () => {
    expect(rollingMedian([1, 5, 3, 7, 2], 4)).toEqual([1, 3, 3, 4, 4]);
  });

  it("matches a naive computation on the 14 seeded cases", () => {
    const { points, median: med } = learningCurve(seed.cleared_cases, seed.benchmarks);
    expect(points).toHaveLength(14);
    expect(med).toHaveLength(14);
    const pct = points.map((p) => p.pct);
    pct.forEach((_, i) => {
      const win = pct.slice(Math.max(0, i - 3), i + 1).sort((a, b) => a - b);
      const expected = win.length % 2 ? win[(win.length - 1) / 2] : (win[win.length / 2 - 1] + win[win.length / 2]) / 2;
      expect(med[i].pct).toBe(expected);
      expect(med[i].seq).toBe(i + 1);
    });
  });

  it("is falling across the seeded cases", () => {
    const { median: med } = learningCurve(seed.cleared_cases, seed.benchmarks);
    expect(med[med.length - 1].pct).toBeLessThan(med[0].pct);
  });

  it("filters to one domain and keeps clearance order", () => {
    const { points } = learningCurve(seed.cleared_cases, seed.benchmarks, "people");
    expect(points.map((p) => p.seq)).toEqual([1, 5, 9, 12, 14]);
  });
});
