/** Benchmark source selection and the learning curve (docs/04-data-model.md §2, S9 Acceleration). */
import type { Benchmark, ClearedCase, DomainSlug } from "./schemas";

export const RYPPLES_CASE_THRESHOLD = 8;

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export type EffectiveBenchmark = {
  domain_id: DomainSlug;
  days: number;
  source_kind: Benchmark["source_kind"];
  source_note: string;
  confidence: Benchmark["confidence"];
  cases: number;
  /** seeded outside/blended value (what the curve is measured against) */
  seeded_days: number;
};

export function effectiveBenchmark(
  domain: DomainSlug,
  benchmarks: Benchmark[],
  cases: ClearedCase[],
): EffectiveBenchmark {
  const seeded = benchmarks.find((b) => b.domain_id === domain);
  if (!seeded) throw new Error(`No benchmark seeded for ${domain}`);
  const own = cases.filter((c) => c.domain_id === domain);
  if (own.length >= RYPPLES_CASE_THRESHOLD) {
    return {
      domain_id: domain,
      days: Math.round(median(own.map((c) => c.days))),
      source_kind: "rypples",
      source_note: `Rypples median of ${own.length} cleared cases`,
      confidence: own.length >= 12 ? "high" : "medium",
      cases: own.length,
      seeded_days: seeded.days,
    };
  }
  return {
    domain_id: domain,
    days: seeded.days,
    source_kind: seeded.source_kind,
    source_note: seeded.source_note,
    confidence: seeded.confidence,
    cases: own.length,
    seeded_days: seeded.days,
  };
}

export const sourceLabel = (k: Benchmark["source_kind"]) =>
  k === "rypples" ? "Rypples data" : k === "blended" ? "blended ref" : "outside ref";

/** Rolling median over the trailing `window` points (fewer at the start). */
export function rollingMedian(values: number[], window = 4): number[] {
  return values.map((_, i) => median(values.slice(Math.max(0, i - window + 1), i + 1)));
}

export type CurvePoint = { seq: number; label: string; domain_id: DomainSlug; days: number; pct: number };

/** y = days to clear as % of that domain's seeded benchmark, in clearance order. */
export function learningCurve(cases: ClearedCase[], benchmarks: Benchmark[], domain?: DomainSlug) {
  const sorted = [...cases].sort((a, b) => a.cleared_seq - b.cleared_seq);
  const points: CurvePoint[] = sorted
    .filter((c) => !domain || c.domain_id === domain)
    .map((c) => {
      const b = benchmarks.find((b) => b.domain_id === c.domain_id)!;
      return { seq: c.cleared_seq, label: c.case_label, domain_id: c.domain_id, days: c.days, pct: Math.round((c.days / b.days) * 100) };
    });
  const med = rollingMedian(points.map((p) => p.pct), 4);
  return { points, median: med.map((m, i) => ({ seq: points[i].seq, pct: m })) };
}
