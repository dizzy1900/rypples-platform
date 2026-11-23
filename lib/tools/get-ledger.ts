import { z } from "zod";
import { allow, companyFor, defineTool, isFounder, ref, stateFor } from "./types";

const SCOPES = ["rypples", "founder"] as const;
export const getLedger = defineTool({
  name: "get_ledger",
  title: "Commitment ledger",
  description: "Everything Rypples has committed to a company: each commitment with who it is from, due date, status (not started, in progress, open, delivered) and the founder's rating once delivered. Input is the company slug.",
  input: z.object({ slug: z.string().min(1).max(100) }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const c = companyFor(ctx, s, input.slug);
    const rows = s.commitments.filter((x) => x.company_id === c.id).sort((a, b) => a.sort - b.sort);
    const data = {
      company: c.name,
      commitments: rows.map((x) => ({ id: x.id, title: x.title, from: x.from_label, due: x.due_label, status: x.status, rating: x.rating })),
      delivered: rows.filter((x) => x.status === "delivered").length,
      total: rows.length,
      provenance: "illustrative",
    };
    return { data, refs: [ref.ledger(c.slug, c.name, isFounder(ctx))] };
  },
});
