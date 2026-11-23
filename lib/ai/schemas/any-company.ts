/** F2 schemas (docs/07-ai.md F2). */
import { z } from "zod";
import { toStrictJsonSchema } from "./common";

export const AnyCompanyInput = z.object({
  query: z.string().trim().min(2).max(200),
  runAgain: z.boolean().optional(),
});

export const RelevanceCheck = z.object({
  status: z.enum(["ok", "declined", "ambiguous", "not_found"]),
  name: z.string().max(200),
  website: z.string().max(300).nullable(),
  description: z.string().max(400),
  vertical: z.enum(["Ocean Health", "Ecosystems", "Blue Foods", "Maritime", "Ocean Intelligence"]).nullable(),
  reason: z.string().max(400),
  candidates: z.array(z.object({ name: z.string().max(200), website: z.string().max(300).nullable() })).max(3),
});
export type RelevanceCheckT = z.infer<typeof RelevanceCheck>;
export const RelevanceCheckJson = toStrictJsonSchema(RelevanceCheck);

const VERTS = ["Ocean Health", "Ecosystems", "Blue Foods", "Maritime", "Ocean Intelligence"];
export function normalizeRelevance(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw as Record<string, unknown>) };
  if (typeof r.status === "string") r.status = r.status.toLowerCase().trim().replace(/\s+/g, "_");
  if (typeof r.vertical === "string") r.vertical = VERTS.find((v) => v.toLowerCase() === (r.vertical as string).toLowerCase().trim()) ?? null;
  return r;
}

/** Deterministic insufficient-evidence rule (docs/07-ai.md F2). */
export function insufficientReasons(p: { evidenceCount: number; sourceDomains: number; bindingEvidence: number | null }): string[] {
  const r: string[] = [];
  if (p.evidenceCount < 6) r.push("fewer than 6 evidence items");
  if (p.sourceDomains < 3) r.push("fewer than 3 distinct source domains");
  if (p.bindingEvidence != null && p.bindingEvidence < 2) r.push("the proposed binding domain has fewer than 2 evidence items");
  return r;
}
