/** F7 schemas (docs/07-ai.md F7 step 1). */
import { z } from "zod";
import { INTENTS } from "@/lib/domain/program-map";
import { Slug, toStrictJsonSchema } from "./common";

export const DayOneInput = z.object({ dealId: z.string().min(1).max(100) });

export const OPERATOR_ROLES = [
  "Board partner",
  "Finance expert",
  "Go-To-Market expert",
  "People expert",
  "Impact expert",
  "Independent technical expert",
] as const;

export const DayOnePlan = z.object({
  binding: z.object({ domain: Slug, statement: z.string().max(140) }),
  priorities: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(3),
        title: z.string().max(200),
        domain: Slug,
        intent: z.enum(INTENTS),
        mission: z.object({ title: z.string().max(200), operator_role: z.enum(OPERATOR_ROLES), due_weeks: z.number().int().min(1).max(26) }),
      }),
    )
    .length(3),
});
export type DayOnePlanT = z.infer<typeof DayOnePlan>;
export const DayOnePlanJson = toStrictJsonSchema(DayOnePlan);

export function planIssues(p: DayOnePlanT, expectedDomain: string): string[] {
  const issues: string[] = [];
  if (p.binding.domain !== expectedDomain) issues.push(`binding domain must be ${expectedDomain}`);
  const ranks = p.priorities.map((x) => x.rank).sort();
  if (ranks.join(",") !== "1,2,3") issues.push("ranks must be 1, 2, 3");
  return issues;
}

export function normalizePlan(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as { binding?: { domain?: unknown }; priorities?: { domain?: unknown; intent?: unknown; mission?: { operator_role?: unknown } }[] };
  if (r.binding && typeof r.binding.domain === "string") r.binding.domain = r.binding.domain.toLowerCase();
  for (const p of r.priorities ?? []) {
    if (typeof p.domain === "string") p.domain = p.domain.toLowerCase();
    if (typeof p.intent === "string") p.intent = p.intent.toLowerCase();
    if (p.mission && typeof p.mission.operator_role === "string") {
      const m = OPERATOR_ROLES.find((o) => o.toLowerCase() === (p.mission!.operator_role as string).toLowerCase());
      if (m) p.mission.operator_role = m;
    }
  }
  return raw;
}
