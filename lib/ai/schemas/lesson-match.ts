/** F4 schemas (docs/07-ai.md F4). */
import { z } from "zod";
import { toStrictJsonSchema } from "./common";

export const LessonMatchInput = z.object({ lessonId: z.string().min(1).max(100) });

export const LessonMatchOut = z.object({
  matches: z
    .array(z.object({ company_id: z.string(), reason: z.string().max(220), fit: z.enum(["strong", "possible"]) }))
    .max(3),
  excluded: z.array(z.object({ company_id: z.string(), reason: z.string().max(300) })),
});
export type LessonMatchOutT = z.infer<typeof LessonMatchOut>;
export const LessonMatchJson = toStrictJsonSchema(LessonMatchOut);

const STOP = new Set(["their", "there", "which", "about", "with", "from", "into", "these", "those", "would", "could", "should", "company", "companies", "lesson", "strategic"]);
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z][a-z0-9()-]{4,}/g) ?? []).filter((w) => !STOP.has(w)));

/** A reason must mention a specific fact about the company: share a significant word with its facts. */
export function reasonCitesFact(reason: string, facts: string[]): boolean {
  const r = words(reason);
  for (const f of facts) for (const w of words(f)) if (r.has(w)) return true;
  return false;
}
