/**
 * Server environment, validated once (docs/10-security-cost-ops.md §6).
 * Import only from server code. `lib/env.public.ts` holds the public subset.
 */
import "server-only";
import { z } from "zod";

const isMonday = (s: string) => new Date(`${s}T12:00:00Z`).getUTCDay() === 1;

const ServerEnv = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  MODEL_FAST: z.string().default("claude-haiku-5-5"),
  MODEL_MAIN: z.string().default("claude-sonnet-5-5"),
  MODEL_DEEP: z.string().optional(),
  INSFORGE_BASE_URL: z.string().url().optional(),
  INSFORGE_SERVICE_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  LIVE_AI: z.enum(["on", "off"]).default("off"),
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(25),
  AI_F2_DAILY_RUNS: z.coerce.number().int().positive().default(60),
  AI_PRIORITY_BUDGET_USD: z.coerce.number().positive().default(15),
  DEMO_PRIORITY_TOKEN: z.string().optional(),
  IP_HASH_SALT: z.string().default("dev-salt-change-me"),
  SCENARIO_DATE: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default("2026-11-23")
    .refine(isMonday, { message: "SCENARIO_DATE must be a Monday (seeded week offsets assume it)" }),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | null = null;
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${lines}`);
  }
  cached = parsed.data;
  return cached;
}

/** True when a live Anthropic call is possible at all (key present and LIVE_AI=on). */
export const liveConfigured = () => env().LIVE_AI === "on" && !!env().ANTHROPIC_API_KEY;
/** True when InsForge credentials are configured; otherwise the in-memory store is used. */
export const insforgeConfigured = () => !!env().INSFORGE_BASE_URL && !!env().INSFORGE_SERVICE_KEY;
