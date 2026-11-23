/** F5 input (docs/07-ai.md F5). Prose output: no structured schema. */
import { z } from "zod";

export const BoardPackInput = z.object({
  companyId: z.string().min(1).max(100),
  sectionKey: z.enum(["letter", "asks"]),
});
