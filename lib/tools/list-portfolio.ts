import { z } from "zod";
import { portfolioRows } from "@/lib/domain/portfolio-stats";
import { allow, defineTool, ref, stateFor, uniqRefs } from "./types";

const SCOPES = ["rypples", "public"] as const;
export const listPortfolio = defineTool({
  name: "list_portfolio",
  title: "List the portfolio",
  description:
    "List active portfolio companies with their vertical, region, stage, current binding constraint, days the constraint has been open, the benchmark for that constraint (days, source kind, confidence), whether it is over benchmark, and the founders' rating. Use for questions about who is stuck, behind benchmark, or in a vertical. Benchmarks with source_kind 'outside' or confidence 'low' must be caveated.",
  input: z.object({ vertical: z.enum(["Ocean Health", "Ecosystems", "Blue Foods", "Maritime", "Ocean Intelligence"]).optional() }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const domainLabel = (d: string | null) => s.domains.find((x) => x.slug === d)?.label ?? d;
    const rows = portfolioRows(s).filter((r) => !input.vertical || r.company.vertical === input.vertical);
    const data = {
      companies: rows.map((r) => ({
        slug: r.company.slug,
        name: r.company.name,
        tagline: r.company.tagline,
        vertical: r.company.vertical,
        region: r.company.region,
        stage: r.company.stage,
        constraint: r.constraintDomain ? { domain: r.constraintDomain, label: domainLabel(r.constraintDomain), statement: r.constraintStatement, provisional: r.provisional } : null,
        days_open: r.daysOpen,
        benchmark: r.benchmark ? { days: r.benchmark.days, source_kind: r.benchmark.source_kind, confidence: r.benchmark.confidence, note: r.benchmark.source_note } : null,
        over_benchmark: r.overBenchmark,
        rating: r.rating,
        provenance: r.company.provenance,
      })),
      count: rows.length,
    };
    return { data, refs: uniqRefs([ref.portfolio(), ...rows.filter((r) => r.overBenchmark).map((r) => ref.company(r.company, ctx.viewer))]) };
  },
});
