/** F3 input (docs/07-ai.md F3, docs/10 §5: 1,000 characters). */
import { z } from "zod";

export const CaptainScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("os") }),
  z.object({ kind: z.literal("bridge"), slug: z.string().min(1).max(100) }),
]);
export const CaptainInput = z.object({
  message: z.string().trim().min(1).max(1000),
  scope: CaptainScope,
});
export const CaptainResetInput = z.object({ scope: CaptainScope });
