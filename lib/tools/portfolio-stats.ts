import { z } from "zod";
import { portfolioCounts, stuckByConstraint } from "@/lib/domain/portfolio-stats";
import { programsRunning, lessonsSent, impactReporting } from "@/lib/data/projections/refs";
import { allow, defineTool, ref, stateFor } from "./types";

const SCOPES = ["rypples", "public"] as const;
export const portfolioStatsTool = defineTool({
  name: "portfolio_stats",
  title: "Portfolio statistics",
  description:
    "Portfolio-level numbers: companies grouped by binding constraint, how many are over benchmark, backed / active / exit counts, the founders' average rating of Rypples, programs running, lessons sent and impact reporting. Use for overview questions.",
  input: z.object({}).strict(),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const c = portfolioCounts(s);
    const imp = impactReporting(s);
    const data = {
      stuck_by_constraint: stuckByConstraint(s).map((g) => ({ domain: g.domain, label: g.label, count: g.count, companies: g.companies.map((x) => x.name) })),
      over_benchmark: c.overBenchmark,
      backed: c.backed,
      active: c.active,
      active_public: c.activePublic,
      unannounced: c.unannounced,
      exits: c.exits,
      firm_rating: c.firmRating,
      rated_companies: c.ratedCompanies,
      programs_running: programsRunning(s),
      lessons_sent: lessonsSent(s),
      impact_reporting: { reported: imp.reported, total: imp.total },
      provenance: "scenario figures with illustrative ratings and program counts",
    };
    return { data, refs: [ref.portfolio()] };
  },
});
