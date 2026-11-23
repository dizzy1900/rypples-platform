/** F6 schemas (docs/07-ai.md F6). */
import { z } from "zod";
import { toStrictJsonSchema } from "./common";
import { textDigitViolations } from "../guardrails";

export const ShareholderInput = z.object({ quarter: z.string().regex(/^Q[1-4] \d{4}$/).default("Q4 2026") });

const RefPtr = z.object({ type: z.string().max(40), id: z.string().max(100), field: z.string().max(60) });
export const ShareholderOut = z.object({
  title: z.string().max(200),
  segments: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("text"), text: z.string().max(2000) }),
        z.object({ kind: z.literal("ref"), ref: RefPtr }),
      ]),
    )
    .min(1)
    .max(80),
  held_back: z.array(z.object({ type: z.string(), id: z.string(), reason: z.string().max(300) })),
});
export type ShareholderOutT = z.infer<typeof ShareholderOut>;
export const ShareholderJson = toStrictJsonSchema(ShareholderOut);

/** Every text segment free of figures, every ref resolvable. */
export function shareholderIssues(d: ShareholderOutT, resolves: (r: z.infer<typeof RefPtr>) => boolean): string[] {
  const issues: string[] = [];
  d.segments.forEach((s, i) => {
    if (s.kind === "text") {
      const v = textDigitViolations(s.text);
      if (v.length) issues.push(`segment ${i} has figures in text: ${v.join(", ")}`);
    } else if (!resolves(s.ref)) issues.push(`segment ${i} ref does not resolve: ${s.ref.type}/${s.ref.id}/${s.ref.field}`);
  });
  return issues;
}
