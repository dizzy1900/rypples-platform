/** Eval judge verdict (docs/11-testing-and-evals.md §4). */
import { z } from "zod";
import { toStrictJsonSchema } from "./common";

export const JudgeVerdict = z.object({ pass: z.boolean(), issues: z.array(z.string()), notes: z.string() });
export const JudgeJson = toStrictJsonSchema(JudgeVerdict);
