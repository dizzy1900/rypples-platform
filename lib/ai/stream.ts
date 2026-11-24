/**
 * Server helpers for streamed flows (docs/07-ai.md §3): turn an async generator of FlowEvents
 * into an SSE Response, plus a small channel for flows that emit from parallel callbacks.
 */
import { encodeEvent, FlowEventSchema, type FlowEvent } from "./sse";

export const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
} as const;

/**
 * Build the SSE response. The generator is expected to yield the `mode` event first
 * (the runner does). Thrown errors become an `error` event; invalid events are dropped in production
 * and throw in tests, so contract drift is caught early.
 */
export function sseResponse(gen: AsyncGenerator<FlowEvent>, opts: { onDone?: () => void | Promise<void> } = {}): Response {
  let closed = false;
  let finished = false;
  // Record the run before the body closes: on serverless hosts the function can be frozen as soon as
  // the response ends, and the run's cost must reach the data store for the spending cap to hold.
  const finish = async () => {
    if (finished) return;
    finished = true;
    try {
      await opts.onDone?.();
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "flow onDone failed", error: (err as Error).message }));
    }
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) {
          await finish();
          closed = true;
          controller.close();
          return;
        }
        const parsed = FlowEventSchema.safeParse(value);
        if (!parsed.success) {
          if (process.env.VITEST) throw new Error(`Invalid FlowEvent: ${JSON.stringify(value).slice(0, 200)}`);
          return;
        }
        controller.enqueue(encodeEvent(parsed.data));
      } catch (err) {
        console.error(JSON.stringify({ level: "error", msg: "flow stream failed", error: (err as Error).message }));
        if (!closed) {
          controller.enqueue(encodeEvent({ type: "error", message: "Captain couldn't finish this run. Nothing was saved." }));
          await finish();
          closed = true;
          controller.close();
        }
      }
    },
    async cancel() {
      // the visitor left mid-run: stop the flow, but still record what it cost so far
      closed = true;
      await gen.return?.(undefined);
      await finish();
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

/** Push-based async queue: parallel callbacks push events, the flow generator drains them in order. */
export class Channel<T> {
  private buf: T[] = [];
  private waiting: ((r: IteratorResult<T>) => void) | null = null;
  private done = false;
  push(v: T) {
    if (this.done) return;
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w({ value: v, done: false });
    } else this.buf.push(v);
  }
  close() {
    this.done = true;
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w({ value: undefined as unknown as T, done: true });
    }
  }
  async *drain(): AsyncGenerator<T> {
    for (;;) {
      if (this.buf.length) {
        yield this.buf.shift()!;
        continue;
      }
      if (this.done) return;
      const r = await new Promise<IteratorResult<T>>((res) => (this.waiting = res));
      if (r.done) return;
      yield r.value;
    }
  }
}

/** Run `work` while yielding whatever it pushes into the channel; returns work's result. */
export async function* withChannel<R>(work: (push: (e: FlowEvent) => void) => Promise<R>): AsyncGenerator<FlowEvent, R> {
  const ch = new Channel<FlowEvent>();
  let result!: R;
  let failure: unknown = null;
  const p = work((e) => ch.push(e))
    .then((r) => {
      result = r;
    })
    .catch((e) => {
      failure = e;
    })
    .finally(() => ch.close());
  yield* ch.drain();
  await p;
  if (failure) throw failure;
  return result;
}
