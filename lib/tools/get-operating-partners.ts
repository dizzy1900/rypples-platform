import { z } from "zod";
import { firmCapacity, hoursLeft, inHoursPool, operatorLoad } from "@/lib/domain/capacity";
import { allow, defineTool, isFounder, ref, stateFor } from "./types";

const SCOPES = ["rypples", "public", "founder"] as const;
export const getOperatingPartners = defineTool({
  name: "get_operating_partners",
  title: "Operating partners and programs",
  description:
    "Operating partners and the programs they deliver: the program catalogue (domain, weeks, hours, outcome, who delivers it), expert hours this quarter, each active expert or specialist with hours committed, hours left and load, board-level partners (external, one company each), and partners still being found or onboarded. Use for capacity questions. Founders see the catalogue only.",
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
      operators: s.operators
        .filter(inHoursPool)
        .sort((a, b) => operatorLoad(b) - operatorLoad(a))
        .map((o) => ({
          id: o.id,
          role: o.role,
          focus: o.focus,
          hours_quarter: o.hours_quarter,
          hours_committed: o.hours_committed,
          hours_left: hoursLeft(o),
          pct_committed: Math.round(operatorLoad(o) * 100),
          covers: o.covers.map((id) => s.companies.find((c) => c.id === id)?.name ?? id),
        })),
      board_level_partners: s.operators
        .filter((o) => o.role_key === "board_partner" && o.stage === "active")
        .map((o) => ({ id: o.id, focus: o.focus, company: o.covers.map((id) => s.companies.find((c) => c.id === id)?.name ?? id)[0] ?? null })),
      finding_and_onboarding: s.operators
        .filter((o) => o.stage !== "active")
        .map((o) => ({ role: o.role, focus: o.focus, stage: o.stage.replace("_", " "), note: o.stage_note })),
      provenance: "illustrative",
    };
    const tight = data.operators.filter((o) => o.pct_committed >= 80);
    return { data, refs: [ref.growth(), ...tight.map((o) => ref.operator(o.id, o.role))] };
  },
});
