import { z } from "zod";
import { effectiveBenchmark, RYPPLES_CASE_THRESHOLD } from "@/lib/domain/benchmarks";
import { allow, defineTool, ref, stateFor } from "./types";

const SCOPES = ["rypples", "public"] as const;
export const getBenchmarks = defineTool({
  name: "get_benchmarks",
  title: "Benchmarks",
  description:
    "Benchmark days to clear a binding constraint, per domain: the days, the source kind ('outside' reference, 'blended', or 'rypples' own data once 8 cases have cleared), how many Rypples cases have cleared of the 8 needed, and confidence. Outside or low-confidence benchmarks must be caveated in any answer.",
  input: z.object({ domain: z.enum(["commercial", "financing", "operations", "technology", "regulatory", "people", "ai", "impact"]).optional() }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const doms = [...s.domains].sort((a, b) => a.sort - b.sort).filter((d) => !input.domain || d.slug === input.domain);
    const data = {
      benchmarks: doms.map((d) => {
        const b = effectiveBenchmark(d.slug, s.benchmarks, s.cleared_cases);
        return { domain: d.slug, label: d.label, days: b.days, source_kind: b.source_kind, source_note: b.source_note, rypples_cases: b.cases, cases_needed: RYPPLES_CASE_THRESHOLD, confidence: b.confidence };
      }),
    };
    return { data, refs: doms.map((d) => ref.benchmark(d.slug, d.label, "illustrative")) };
  },
});
