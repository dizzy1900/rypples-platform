import { z } from "zod";
import { allow, defineTool, ref, stateFor } from "./types";

const SCOPES = ["rypples"] as const;
export const listDecisions = defineTool({
  name: "list_decisions",
  title: "Open decisions",
  description: "Decisions waiting for Jerome: the question, the context line and where to act.",
  input: z.object({}).strict(),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const open = s.decisions.filter((d) => d.status === "open").sort((a, b) => a.sort - b.sort);
    return {
      data: { decisions: open.map((d) => ({ id: d.id, context: d.context_label, question: d.question, line: d.line, action: d.action_label })), count: open.length },
      refs: open.map((d) => ref.decision(d.id, d.question, d.route)),
    };
  },
});
