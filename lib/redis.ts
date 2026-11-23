/**
 * Small key-value layer for budget counters, rate limits, the circuit breaker and caches.
 * REDIS_URL → ioredis; UPSTASH_REDIS_REST_URL + _TOKEN → Upstash REST via fetch;
 * neither → an in-process Map with TTLs (dev, tests, single-instance demos).
 */
import "server-only";
import { env } from "@/lib/env";

export interface Kv {
  readonly kind: "redis" | "upstash" | "memory";
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incrFloat(key: string, by: number, ttlSec: number): Promise<number>;
  /** Sliding-window log: record a hit at `nowMs` and return how many hits fall inside the window (including this one). */
  windowHit(key: string, nowMs: number, windowMs: number, member: string): Promise<number>;
  /** Count hits inside the window without recording one. */
  windowCount(key: string, nowMs: number, windowMs: number): Promise<number>;
  pushCapped(key: string, value: string, max: number, ttlSec: number): Promise<void>;
  list(key: string, max: number): Promise<string[]>;
}

// ── Memory ──────────────────────────────────────────────────────────────
type Entry = { v: string | string[] | Map<string, number>; exp: number | null };
const g = globalThis as unknown as { __rypplesKv?: Map<string, Entry> };
const mem = () => (g.__rypplesKv ??= new Map());

function live(key: string): Entry | null {
  const e = mem().get(key);
  if (!e) return null;
  if (e.exp != null && e.exp < Date.now()) {
    mem().delete(key);
    return null;
  }
  return e;
}

class MemoryKv implements Kv {
  readonly kind = "memory" as const;
  async get(key: string) {
    const e = live(key);
    return typeof e?.v === "string" ? e.v : null;
  }
  async set(key: string, value: string, ttlSec?: number) {
    mem().set(key, { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : null });
  }
  async del(key: string) {
    mem().delete(key);
  }
  async incrFloat(key: string, by: number, ttlSec: number) {
    const e = live(key);
    const next = (typeof e?.v === "string" ? Number(e.v) : 0) + by;
    mem().set(key, { v: String(next), exp: e?.exp ?? Date.now() + ttlSec * 1000 });
    return next;
  }
  async windowHit(key: string, nowMs: number, windowMs: number, member: string) {
    const e = live(key);
    const m = e?.v instanceof Map ? e.v : new Map<string, number>();
    for (const [k, t] of m) if (t <= nowMs - windowMs) m.delete(k);
    m.set(member, nowMs);
    mem().set(key, { v: m, exp: nowMs + windowMs });
    return m.size;
  }
  async windowCount(key: string, nowMs: number, windowMs: number) {
    const e = live(key);
    if (!(e?.v instanceof Map)) return 0;
    let n = 0;
    for (const t of e.v.values()) if (t > nowMs - windowMs) n++;
    return n;
  }
  async pushCapped(key: string, value: string, max: number, ttlSec: number) {
    const e = live(key);
    const arr = Array.isArray(e?.v) ? e.v : [];
    arr.unshift(value);
    mem().set(key, { v: arr.slice(0, max), exp: Date.now() + ttlSec * 1000 });
  }
  async list(key: string, max: number) {
    const e = live(key);
    return Array.isArray(e?.v) ? e.v.slice(0, max) : [];
  }
}

// ── ioredis ─────────────────────────────────────────────────────────────
type RedisLike = {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, ...args: (string | number)[]): Promise<unknown>;
  del(k: string): Promise<unknown>;
  multi(): {
    incrbyfloat(k: string, n: number): unknown;
    expire(k: string, s: number, mode?: string): unknown;
    zremrangebyscore(k: string, min: number | string, max: number | string): unknown;
    zadd(k: string, score: number, member: string): unknown;
    zcard(k: string): unknown;
    pexpire(k: string, ms: number): unknown;
    lpush(k: string, v: string): unknown;
    ltrim(k: string, a: number, b: number): unknown;
    exec(): Promise<[Error | null, unknown][] | null>;
  };
  zcount(k: string, min: number | string, max: number | string): Promise<number>;
  lrange(k: string, a: number, b: number): Promise<string[]>;
};

class IoRedisKv implements Kv {
  readonly kind = "redis" as const;
  constructor(private r: RedisLike) {}
  async get(key: string) {
    return this.r.get(key);
  }
  async set(key: string, value: string, ttlSec?: number) {
    if (ttlSec) await this.r.set(key, value, "EX", ttlSec);
    else await this.r.set(key, value);
  }
  async del(key: string) {
    await this.r.del(key);
  }
  async incrFloat(key: string, by: number, ttlSec: number) {
    const res = await this.r.multi().incrbyfloat(key, by).expire(key, ttlSec, "NX").exec() as unknown as [Error | null, unknown][];
    return Number(res?.[0]?.[1] ?? 0);
  }
  async windowHit(key: string, nowMs: number, windowMs: number, member: string) {
    const m = this.r.multi();
    m.zremrangebyscore(key, 0, nowMs - windowMs);
    m.zadd(key, nowMs, member);
    m.zcard(key);
    m.pexpire(key, windowMs);
    const res = await m.exec();
    return Number(res?.[2]?.[1] ?? 0);
  }
  async windowCount(key: string, nowMs: number, windowMs: number) {
    return this.r.zcount(key, `(${nowMs - windowMs}`, "+inf");
  }
  async pushCapped(key: string, value: string, max: number, ttlSec: number) {
    const m = this.r.multi();
    m.lpush(key, value);
    m.ltrim(key, 0, max - 1);
    m.expire(key, ttlSec);
    await m.exec();
  }
  async list(key: string, max: number) {
    return this.r.lrange(key, 0, max - 1);
  }
}

// ── Upstash REST ────────────────────────────────────────────────────────
class UpstashKv implements Kv {
  readonly kind = "upstash" as const;
  constructor(private url: string, private token: string) {}
  private async cmd(...args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(args.map(String)),
      cache: "no-store",
    });
    const j = (await res.json()) as { result?: unknown; error?: string };
    if (j.error) throw new Error(`Upstash: ${j.error}`);
    return j.result;
  }
  private async pipeline(cmds: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      cache: "no-store",
    });
    const j = (await res.json()) as { result?: unknown; error?: string }[];
    return j.map((x) => x.result);
  }
  async get(key: string) {
    const r = await this.cmd("GET", key);
    return r == null ? null : String(r);
  }
  async set(key: string, value: string, ttlSec?: number) {
    if (ttlSec) await this.cmd("SET", key, value, "EX", ttlSec);
    else await this.cmd("SET", key, value);
  }
  async del(key: string) {
    await this.cmd("DEL", key);
  }
  async incrFloat(key: string, by: number, ttlSec: number) {
    const r = await this.pipeline([["INCRBYFLOAT", key, by], ["EXPIRE", key, ttlSec, "NX"]]);
    return Number(r[0] ?? 0);
  }
  async windowHit(key: string, nowMs: number, windowMs: number, member: string) {
    const r = await this.pipeline([
      ["ZREMRANGEBYSCORE", key, 0, nowMs - windowMs],
      ["ZADD", key, nowMs, member],
      ["ZCARD", key],
      ["PEXPIRE", key, windowMs],
    ]);
    return Number(r[2] ?? 0);
  }
  async windowCount(key: string, nowMs: number, windowMs: number) {
    return Number(await this.cmd("ZCOUNT", key, `(${nowMs - windowMs}`, "+inf"));
  }
  async pushCapped(key: string, value: string, max: number, ttlSec: number) {
    await this.pipeline([["LPUSH", key, value], ["LTRIM", key, 0, max - 1], ["EXPIRE", key, ttlSec]]);
  }
  async list(key: string, max: number) {
    return ((await this.cmd("LRANGE", key, 0, max - 1)) as string[]) ?? [];
  }
}

let kv: Kv | null = null;
export function getKv(): Kv {
  if (kv) return kv;
  const e = env();
  if (e.REDIS_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("ioredis") as typeof import("ioredis");
    kv = new IoRedisKv(new Redis(e.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false }) as unknown as RedisLike);
  } else if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) {
    kv = new UpstashKv(e.UPSTASH_REDIS_REST_URL, e.UPSTASH_REDIS_REST_TOKEN);
  } else {
    kv = new MemoryKv();
  }
  return kv;
}

/** Tests only. */
export function __resetKv() {
  g.__rypplesKv = undefined;
  kv = null;
}
