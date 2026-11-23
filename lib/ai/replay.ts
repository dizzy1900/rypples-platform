/**
 * Replay a precomputed event array through the live stream with realistic pacing
 * (docs/07-ai.md §3): steps 700–1,200 ms, scores 300–600 ms apart, tokens ~20–40 ms per chunk.
 * The whole replay is scaled to finish within ~12 s. Pacing is deterministic per seed.
 * Under Vitest (or REPLAY_INSTANT=1) there are no delays.
 */
import type { FlowEvent } from "./sse";

const MAX_TOTAL_MS = 11_500;

function prng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function replayDelays(events: FlowEvent[], seed = "replay"): number[] {
  const r = prng(seed);
  const between = (a: number, b: number) => a + r() * (b - a);
  const raw = events.map((e) => {
    switch (e.type) {
      case "step":
        return e.state === "done" ? between(700, 1200) : between(120, 220);
      case "score":
        return between(300, 600);
      case "evidence":
        return between(60, 140);
      case "source":
        return between(150, 300);
      case "token":
        return between(20, 40);
      case "refs":
        return 120;
      default:
        return 0;
    }
  });
  const total = raw.reduce((a, b) => a + b, 0);
  const k = total > MAX_TOTAL_MS ? MAX_TOTAL_MS / total : 1;
  return raw.map((d) => Math.round(d * k));
}

const instant = () => !!process.env.VITEST || process.env.REPLAY_INSTANT === "1";
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function* replay(events: FlowEvent[], seed?: string): AsyncGenerator<FlowEvent> {
  const delays = replayDelays(events, seed);
  for (let i = 0; i < events.length; i++) {
    if (!instant() && delays[i] > 0) await sleep(delays[i]);
    yield events[i];
  }
}

/** Split prose into token-sized chunks for replay (3–6 characters, keeping words whole where possible). */
export function chunkText(text: string): FlowEvent[] {
  const out: FlowEvent[] = [];
  const parts = text.match(/\S+\s*|\s+/g) ?? [];
  let buf = "";
  for (const p of parts) {
    buf += p;
    if (buf.length >= 12) {
      out.push({ type: "token", text: buf });
      buf = "";
    }
  }
  if (buf) out.push({ type: "token", text: buf });
  return out;
}

/** Small pause between deterministic steps in cached mode, so they read as a sequence. */
export async function pace(ms: number) {
  if (!instant()) await sleep(ms);
}
