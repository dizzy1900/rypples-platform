import { z } from "zod";
import { allow, defineTool, ref, stateFor } from "./types";

const SCOPES = ["rypples", "public"] as const;
export const getImpact = defineTool({
  name: "get_impact",
  title: "Impact reporting",
  description: "Ocean Impact Navigator status per portfolio company: the KPI each reports against and whether it is reported, in progress or not yet reported.",
  input: z.object({}).strict(),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const rows = s.impact_kpis.map((k) => ({ company: s.companies.find((c) => c.id === k.company_id)?.name ?? k.company_id, kpi: k.kpi, status: k.status }));
    const data = { companies: rows, reported: rows.filter((r) => r.status === "reported").length, total: rows.length, framework: "Ocean Impact Navigator", provenance: "illustrative" };
    return { data, refs: [ref.impact()] };
  },
});
