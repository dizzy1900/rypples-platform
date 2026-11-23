import { z } from "zod";
import { allow, companyFor, defineTool, founderCompanyId, ref, stateFor } from "./types";

const SCOPES = ["rypples", "public", "founder"] as const;
export const getStrategicPaths = defineTool({
  name: "get_strategic_paths",
  title: "Strategic paths",
  description: "Strategic relationships today and likely buyers or partners per company, with the Strategic Partner Map program status. Optional company slug.",
  input: z.object({ slug: z.string().min(1).max(100).optional() }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const own = founderCompanyId(ctx);
    const slug = input.slug ?? own;
    const c = slug ? companyFor(ctx, s, slug) : null;
    const rows = s.strategic_paths
      .filter((p) => !c || p.company_id === c.id)
      .filter((p) => ctx.viewer.kind !== "public" || s.companies.find((x) => x.id === p.company_id)?.public);
    const data = {
      paths: rows.map((p) => ({
        company: s.companies.find((x) => x.id === p.company_id)?.name ?? p.company_id,
        now: p.now,
        now_provenance: p.now_provenance,
        now_source_url: s.sources.find((x) => x.id === p.now_source_id)?.url ?? null,
        likely: p.likely,
        likely_provenance: "illustrative",
        program_status: p.program_status,
      })),
    };
    return { data, refs: [ref.paths(), ...(c ? [ref.company(c, ctx.viewer)] : [])] };
  },
});
