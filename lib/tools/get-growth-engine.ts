import { z } from "zod";
import { firmCapacity, hoursLeft, operatorLoad } from "@/lib/domain/capacity";
import { allow, defineTool, isFounder, ref, stateFor } from "./types";

const SCOPES = ["rypples", "public", "founder"] as const;
export const getGrowthEngine = defineTool({
  name: "get_growth_engine",
  title: "Growth Engine",
  description:
    "The Growth Engine: the program catalogue (domain, weeks, hours, outcome, who delivers it), firm operator capacity this quarter, each operator by role with hours committed, hours left and load, board-partner seats, and who is being recruited. Use for capacity questions. Founders see the catalogue only.",
  input: z.object({}).strict(),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const catalogue = s.programs.map((p) => ({ id: p.id, name: p.name, domain: p.domain_id, weeks: p.length_weeks, hours: p.hours, outcome: p.outcome, delivered_by: p.delivered_by_role, running: p.running, done: p.done, rating: p.rating }));
    if (isFounder(ctx)) return { data: { catalogue }, refs: [ref.growth()] };
    const cap = firmCapacity(s.operators);
    const data = {
      catalogue,
      capacity: { hours_committed: cap.committed, hours_total: cap.total, pct_committed: Math.round(cap.pct * 100) },
      operators: [...s.operators]
        .sort((a, b) => operatorLoad(b) - operatorLoad(a))
        .map((o) => ({
          id: o.id,
          role: o.role,
          focus: o.focus,
          hours_quarter: o.hours_quarter,
          hours_committed: o.hours_committed,
          hours_left: hoursLeft(o),
          pct_committed: Math.round(operatorLoad(o) * 100),
          seats_total: o.seats_total,
          seats_used: o.seats_used,
          covers: o.covers.map((id) => s.companies.find((c) => c.id === id)?.name ?? id),
        })),
      recruiting: s.partner_recruiting.map((r) => ({ role: r.role, state: r.state, note: r.note })),
      provenance: "illustrative",
    };
    const tight = data.operators.filter((o) => o.pct_committed >= 80);
    return { data, refs: [ref.growth(), ...tight.map((o) => ref.operator(o.id, o.role))] };
  },
});
