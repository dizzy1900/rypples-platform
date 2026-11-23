/**
 * Per-IP sliding-window rate limits (docs/10-security-cost-ops.md §3). IPs are hashed with
 * IP_HASH_SALT and never stored in plain text. A hit never becomes a raw 429 in the UI:
 * flows turn it into a `fallback` event with reason `rate_limit`.
 */
import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { getKv } from "@/lib/redis";

export type Surface =
  | "f2-new"
  | "f2-again"
  | "captain"
  | "diagnostic"
  | "board-pack"
  | "shareholder-update"
  | "day-one"
  | "lesson-match"
  | "mcp";

const H = 3600_000;
export const LIMITS: Record<Surface, { max: number; windowMs: number }[]> = {
  "f2-new": [
    { max: 4, windowMs: H },
    { max: 12, windowMs: 24 * H },
  ],
  "f2-again": [{ max: 2, windowMs: 24 * H }],
  captain: [{ max: 30, windowMs: H }],
  diagnostic: [{ max: 10, windowMs: H }],
  "board-pack": [{ max: 10, windowMs: H }],
  "shareholder-update": [{ max: 10, windowMs: H }],
  "day-one": [{ max: 10, windowMs: H }],
  "lesson-match": [{ max: 10, windowMs: H }],
  mcp: [{ max: 120, windowMs: 60_000 }],
};

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${env().IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Record a hit and report whether it is within every window for the surface. */
export async function checkLimit(surface: Surface, ipHash: string | null, opts: { priority?: boolean } = {}) {
  if (opts.priority || !ipHash) return { ok: true as const };
  const kv = getKv();
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  for (const w of LIMITS[surface]) {
    const key = `rl:${surface}:${w.windowMs}:${ipHash}`;
    const n = await kv.windowHit(key, now, w.windowMs, member);
    if (n > w.max) return { ok: false as const, windowMs: w.windowMs, max: w.max };
  }
  return { ok: true as const };
}
