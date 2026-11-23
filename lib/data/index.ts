/**
 * The one entry point pages, server actions, tools and flows use to read and write.
 * Reads: getState(sessionId) → seed ∪ session events (or seed only for the PublicViewer).
 * Writes: appendEvent(...) only.
 */
import "server-only";
import { ulid } from "ulid";
import { getSeed } from "./seed";
import { fold, type State } from "./state";
import { MemoryStore, type Store } from "./store";
import { parsePayload, type DemoEvent, type EventPayload, type EventType } from "./events";
import { insforgeConfigured } from "@/lib/env";

let store: Store | null = null;
export function getStore(): Store {
  if (store) return store;
  if (insforgeConfigured()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { InsforgeStore } = require("./insforge/store") as typeof import("./insforge/store");
    store = new InsforgeStore();
  } else {
    store = new MemoryStore();
  }
  return store!;
}

/** Seed only. Used by the PublicViewer (MCP) and for static pages. */
export function getSeedState(): State {
  return fold(getSeed(), []);
}

export async function getState(sessionId: string | null): Promise<State> {
  if (!sessionId) return getSeedState();
  const events = await getStore().listEvents(sessionId);
  return fold(getSeed(), events);
}

export async function appendEvent<T extends EventType>(args: {
  sessionId: string;
  actor: string;
  type: T;
  entityType: string;
  entityId: string;
  payload: EventPayload<T>;
}): Promise<DemoEvent<T>> {
  const payload = parsePayload(args.type, args.payload);
  const e: DemoEvent<T> = {
    id: ulid(),
    firm_id: "rypples",
    session_id: args.sessionId,
    actor: args.actor,
    type: args.type,
    entity_type: args.entityType,
    entity_id: args.entityId,
    payload,
    at: new Date().toISOString(),
  };
  await getStore().appendEvent(e as DemoEvent);
  return e;
}

export type { State };
