/** F1 schemas (docs/07-ai.md F1). Also reused by F2 scoring and synthesis. */
import { z } from "zod";
import { Slug, toStrictJsonSchema } from "./common";

export const DiagnosticInput = z.object({ companyId: z.string().min(1).max(100) });

export const DomainScore = z.object({
  domain: Slug,
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  finding: z.string().max(280),
  evidence_ids: z.array(z.string()),
});
export type DomainScoreT = z.infer<typeof DomainScore>;

export const Synthesis = z.object({
  binding_domain: Slug,
  binding_statement: z.string().max(140),
  rationale: z.string().max(900),
  evidence_ids: z.array(z.string()),
  questions: z.array(z.string()).length(3),
  program_ids: z.array(z.string()).max(2),
  lesson_ids: z.array(z.string()),
});
export type SynthesisT = z.infer<typeof Synthesis>;

export const DomainScoreJson = toStrictJsonSchema(DomainScore);
export const SynthesisJson = toStrictJsonSchema(Synthesis);
export const SCORE_ENUMS = ["domain", "confidence"];
export const SYNTH_ENUMS = ["binding_domain"];

/** Semantic checks: evidence ids exist; a non-null score needs evidence. */
export function scoreIssues(s: DomainScoreT, evidenceIds: Set<string>, expected: string): string[] {
  const issues: string[] = [];
  if (s.domain !== expected) issues.push(`domain should be ${expected}`);
  for (const id of s.evidence_ids) if (!evidenceIds.has(id)) issues.push(`unknown evidence id ${id}`);
  if (s.score != null && s.evidence_ids.filter((id) => evidenceIds.has(id)).length === 0) issues.push("score without evidence");
  return issues;
}

export function synthesisIssues(
  s: SynthesisT,
  ctx: { evidenceIds: Set<string>; programIds: Set<string>; lessonIds: Set<string>; scores: Map<string, number | null> },
): string[] {
  const issues: string[] = [];
  for (const id of s.evidence_ids) if (!ctx.evidenceIds.has(id)) issues.push(`unknown evidence id ${id}`);
  for (const id of s.program_ids) if (!ctx.programIds.has(id)) issues.push(`unknown program ${id}`);
  for (const id of s.lesson_ids) if (!ctx.lessonIds.has(id)) issues.push(`unknown lesson ${id}`);
  const sc = ctx.scores.get(s.binding_domain);
  if (sc != null && sc > 3 && !/\b(despite|although|even though|higher score|scores? (well|higher))\b/i.test(s.rationale))
    issues.push("binding domain scores above 3 without an explicit explanation");
  return issues;
}
