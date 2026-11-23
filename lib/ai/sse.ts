/**
 * Typed server-sent events for every AI flow (docs/07-ai.md §3).
 * Shared by the server (encoder) and the client hook (lib/ai/useFlow.ts).
 */
import { z } from "zod";

export const FLOWS = {
  diagnostic: "/api/ai/diagnostic", // F1
  "any-company": "/api/ai/any-company", // F2
  captain: "/api/ai/captain", // F3
  "lesson-match": "/api/ai/lesson-match", // F4
  "board-pack": "/api/ai/board-pack", // F5
  "shareholder-update": "/api/ai/shareholder-update", // F6
  "day-one": "/api/ai/day-one", // F7
} as const;
export type FlowName = keyof typeof FLOWS;

export const RefSchema = z.object({
  type: z.string(),
  id: z.string(),
  label: z.string(),
  href: z.string().optional(),
  url: z.string().optional(),
  provenance: z.enum(["public", "scenario", "illustrative", "generated"]),
});
export type Ref = z.infer<typeof RefSchema>;

export const FlowEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mode"), mode: z.enum(["live", "cached"]), reason: z.string().optional() }),
  z.object({ type: z.literal("step"), key: z.string(), state: z.enum(["running", "done"]), detail: z.string().optional() }),
  z.object({ type: z.literal("source"), url: z.string(), title: z.string() }),
  z.object({
    type: z.literal("evidence"),
    id: z.string(),
    claim: z.string(),
    url: z.string().optional(),
    title: z.string().optional(),
    cited_text: z.string(),
  }),
  z.object({
    type: z.literal("score"),
    domain: z.string(),
    score: z.number().nullable(),
    confidence: z.string(),
    finding: z.string(),
    evidence_ids: z.array(z.string()),
  }),
  z.object({ type: z.literal("token"), text: z.string() }),
  z.object({ type: z.literal("refs"), refs: z.array(RefSchema) }),
  /** id of the persisted record (diagnostic, run, proposal…); `data` carries a flow-specific payload */
  z.object({ type: z.literal("result"), id: z.string(), data: z.unknown().optional() }),
  z.object({
    type: z.literal("fallback"),
    reason: z.enum(["budget", "error", "disabled", "rate_limit"]),
    replaying: z.boolean(),
    message: z.string().optional(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type FlowEvent = z.infer<typeof FlowEventSchema>;

/** Server: encode one event as an SSE frame. */
export function encodeEvent(e: FlowEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`);
}

/** Client: parse a chunked SSE text stream into events. */
export function createSseParser(onEvent: (e: FlowEvent) => void) {
  let buf = "";
  return (chunk: string) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          const parsed = FlowEventSchema.safeParse(JSON.parse(line.slice(5).trim()));
          if (parsed.success) onEvent(parsed.data);
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  };
}
