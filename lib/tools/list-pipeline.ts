import { z } from "zod";
import { allow, defineTool, ref, stateFor } from "./types";

const SCOPES = ["rypples", "public"] as const;
export const listPipeline = defineTool({
  name: "list_pipeline",
  title: "Pipeline",
  description: "Deals in the pipeline by stage (sourced, first meeting, diligence, IC, led), under codenames, with what each company does, the proposed binding constraint and why. Pipeline companies are never named.",
  input: z.object({}).strict(),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const data = {
      deals: s.deals.map((d) => ({ id: d.id, codename: d.codename, vertical: d.vertical, region: d.region, stage: d.stage, what: d.what, proposed_constraint: d.proposed_constraint, constraint_domain: d.constraint_domain_id, why: d.why, provenance: d.provenance })),
      provenance: "illustrative",
    };
    return { data, refs: [ref.pipeline(), ...s.deals.map((d) => ref.deal(d.id, d.codename))] };
  },
});
