import { z } from "zod";
import { allocationUsed } from "@/lib/domain/capacity";
import { allow, companyFor, defineTool, isFounder, ref, stateFor } from "./types";

const SCOPES = ["rypples", "founder"] as const;
export const getAllocation = defineTool({
  name: "get_allocation",
  title: "Growth Engine allocation",
  description: "A company's Growth Engine allocation from the term sheet (programs and hours), its enrolments with status and operator, and the hours used. Input is the company slug.",
  input: z.object({ slug: z.string().min(1).max(100) }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const c = companyFor(ctx, s, input.slug);
    const a = s.allocations.find((x) => x.company_id === c.id) ?? null;
    const used = allocationUsed(s.enrolments, c.id);
    const data = {
      company: c.name,
      allocation: a ? { year: a.year, programs_total: a.programs_total, hours_total: a.hours_total, source: a.source } : null,
      enrolments: s.enrolments
        .filter((e) => e.company_id === c.id)
        .map((e) => ({
          program: s.programs.find((p) => p.id === e.program_id)?.name ?? e.program_id,
          program_id: e.program_id,
          status: e.status,
          week: e.week,
          of_weeks: e.of_weeks,
          hours: e.hours,
          operator: s.operators.find((o) => o.id === e.operator_id)?.role ?? null,
        })),
      used: { programs: used.programs, hours: used.hours, requested_hours: used.requestedHours },
      provenance: "illustrative",
    };
    return { data, refs: [ref.allocation(c.slug, c.name, isFounder(ctx)), ref.company(c, ctx.viewer)] };
  },
});
