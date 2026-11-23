import { z } from "zod";
import { ulid } from "ulid";
import { appendEvent } from "@/lib/data";
import { actorFor, ScopeError } from "@/lib/viewer";
import { allow, defineTool, ref } from "./types";

const SCOPES = ["rypples", "founder"] as const;
export const proposeNextStep = defineTool({
  name: "propose_next_step",
  title: "Propose a next step",
  description:
    "Propose a concrete next step for a person to approve (it is not carried out). Use at most twice per answer, for actions that follow directly from the records you read. target is the route the step concerns, e.g. '/os/companies/vessev', or null.",
  input: z.object({ title: z.string().min(1).max(140), detail: z.string().max(400), target: z.string().max(200).nullish() }),
  scopes: [...SCOPES],
  readOnly: false,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    if (ctx.viewer.kind === "public" || !ctx.sessionId) throw new ScopeError();
    const id = `prop-${ulid()}`;
    await appendEvent({
      sessionId: ctx.sessionId,
      actor: actorFor(ctx.viewer),
      type: "proposal.created",
      entityType: "proposal",
      entityId: id,
      payload: { proposal_id: id, flow: "captain", kind: "next_step", title: input.title, detail: input.detail, target: input.target ?? null, run_id: null },
    });
    return { data: { proposal_id: id, status: "proposed" as const }, refs: [ref.proposal(id, input.title)] };
  },
});
