"use server";
/**
 * The single write path for UI mutations: validate → append event → revalidate.
 * (docs/03-architecture.md §4). Payloads are validated by the zod schema for each event type.
 */
import { revalidatePath } from "next/cache";
import { appendEvent } from "@/lib/data";
import type { EventPayload, EventType } from "@/lib/data/events";
import { getSessionId } from "@/lib/session";

export type ActResult = { ok: true; id: string } | { ok: false; error: string };

export async function act<T extends EventType>(
  type: T,
  payload: EventPayload<T>,
  opts: { actor: "jerome" | `founder:${string}`; entityType: string; entityId: string },
): Promise<ActResult> {
  try {
    const sessionId = await getSessionId();
    const e = await appendEvent({
      sessionId,
      actor: opts.actor,
      type,
      entityType: opts.entityType,
      entityId: opts.entityId,
      payload,
    });
    revalidatePath("/", "layout");
    return { ok: true, id: e.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save" };
  }
}
