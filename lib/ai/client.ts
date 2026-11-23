/**
 * The one place that talks to the Anthropic API (docs/07-ai.md §1).
 * - `modelFor(task)` reads env overrides (MODEL_FAST / MODEL_MAIN / MODEL_DEEP).
 * - The client is created lazily, so nothing touches the API (or needs a key) in cached mode.
 * - Every call streams (`.stream()` + `finalMessage()`), is costed from `usage`, recorded against
 *   the daily budget, and feeds the circuit breaker.
 * - Sonnet/Opus calls opt into server-side refusal fallbacks (`fallbacks: "default"`).
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import { env } from "@/lib/env";
import type { FlowName } from "./sse";
import { estimateCost, recordApiError, recordApiSuccess, recordSpend } from "./budget";

export type AiTask =
  | "f1-evidence"
  | "f1-score"
  | "f1-synthesis"
  | "f2-relevance"
  | "f2-research"
  | "f2-score"
  | "f2-synthesis"
  | "f3"
  | "f4"
  | "f5"
  | "f6"
  | "f7"
  | "judge";

type Role = "fast" | "main" | "deep";
const ROLE: Record<AiTask, Role> = {
  "f1-evidence": "main",
  "f1-score": "main",
  "f1-synthesis": "main",
  "f2-relevance": "fast",
  "f2-research": "main",
  "f2-score": "main",
  "f2-synthesis": "deep",
  f3: "main",
  f4: "fast",
  f5: "main",
  f6: "main",
  f7: "main",
  judge: "main",
};

export function modelFor(task: AiTask): string {
  const e = env();
  const role = ROLE[task];
  if (role === "fast") return e.MODEL_FAST;
  if (role === "deep") return e.MODEL_DEEP.trim() || e.MODEL_MAIN;
  return e.MODEL_MAIN;
}

/** Every model the app can call with the current env (for the pricing test and check-models). */
export function configuredModels(): string[] {
  const e = env();
  return [...new Set([e.MODEL_FAST, e.MODEL_MAIN, e.MODEL_DEEP.trim() || e.MODEL_MAIN])];
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (client) return client;
  const key = env().ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 110_000 });
  return client;
}

/** Usage accumulated over one flow run (written to agent_runs). */
export type Tracker = {
  flow: FlowName;
  viaPriority: boolean;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  searches: number;
  fetches: number;
  cost_usd: number;
  models: string[];
};

export function newTracker(flow: FlowName, viaPriority = false): Tracker {
  return {
    flow,
    viaPriority,
    calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    searches: 0,
    fetches: 0,
    cost_usd: 0,
    models: [],
  };
}

export type CallParams = {
  task: AiTask;
  system: BetaTextBlockParam[];
  messages: BetaMessageParam[];
  tools?: BetaToolUnion[];
  max_tokens: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  format?: Record<string, unknown>;
  signal?: AbortSignal;
  onText?: (delta: string) => void;
  onBlock?: (block: BetaContentBlock) => void;
};

/** A cacheable system prefix block (static role, taxonomy, catalogue, tone). */
export const cached = (text: string): BetaTextBlockParam => ({ type: "text", text, cache_control: { type: "ephemeral" } });
export const plain = (text: string): BetaTextBlockParam => ({ type: "text", text });

export async function callModel(t: Tracker, p: CallParams): Promise<BetaMessage> {
  const model = modelFor(p.task);
  const fallbacks = !/haiku/.test(model);
  const req = {
    model,
    max_tokens: p.max_tokens,
    system: p.system,
    messages: p.messages,
    ...(p.tools?.length ? { tools: p.tools } : {}),
    output_config: {
      ...(p.effort ? { effort: p.effort } : {}),
      ...(p.format ? { format: { type: "json_schema" as const, schema: p.format } } : {}),
    },
    ...(fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
  let msg: BetaMessage;
  try {
    const stream = anthropic().beta.messages.stream(req as Parameters<Anthropic["beta"]["messages"]["stream"]>[0], {
      signal: p.signal,
    });
    if (p.onText) stream.on("text", p.onText);
    if (p.onBlock) stream.on("contentBlock", p.onBlock);
    msg = (await stream.finalMessage()) as BetaMessage;
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError || p.signal?.aborted) throw err;
    if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
      await recordApiError(t.flow, `${(err as Error).name}: ${(err as Error).message}`);
    }
    throw err;
  }
  await recordApiSuccess();
  const u = msg.usage;
  const cost = estimateCost(msg.model ?? model, u, model);
  t.calls++;
  t.input_tokens += u.input_tokens ?? 0;
  t.output_tokens += u.output_tokens ?? 0;
  t.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
  t.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
  t.searches += u.server_tool_use?.web_search_requests ?? 0;
  t.fetches += u.server_tool_use?.web_fetch_requests ?? 0;
  t.cost_usd += cost;
  if (!t.models.includes(model)) t.models.push(model);
  await recordSpend(t.flow, cost, { viaPriority: t.viaPriority });
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request");
  return msg;
}

export function textOf(msg: BetaMessage): string {
  return msg.content
    .filter((b): b is Extract<BetaContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export class ValidationFailure extends Error {
  constructor(message: string, readonly issues: string[]) {
    super(message);
    this.name = "ValidationFailure";
  }
}

/**
 * Structured call: `output_config.format` json_schema, no tools, no citations (docs/07-ai.md §2).
 * Re-validates with zod (the API strips constraints), then `check` for semantic rules.
 * On a validation failure or `max_tokens`, retries once with a higher max_tokens.
 */
export async function structuredCall<S extends z.ZodType>(
  t: Tracker,
  p: Omit<CallParams, "format" | "tools" | "onText" | "onBlock"> & {
    schema: S;
    jsonSchema: Record<string, unknown>;
    normalize?: (raw: unknown) => unknown;
    check?: (value: z.infer<S>) => string[];
  },
): Promise<z.infer<S>> {
  let maxTokens = p.max_tokens;
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await callModel(t, { ...p, max_tokens: maxTokens, format: p.jsonSchema });
    if (msg.stop_reason === "max_tokens") {
      lastIssues = ["stop_reason max_tokens"];
      maxTokens = Math.min(maxTokens * 2, 32_000);
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(textOf(msg));
    } catch {
      lastIssues = ["response was not JSON"];
      maxTokens = Math.min(Math.round(maxTokens * 1.5), 32_000);
      continue;
    }
    const parsed = p.schema.safeParse(p.normalize ? p.normalize(raw) : raw);
    if (!parsed.success) {
      lastIssues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
      maxTokens = Math.min(Math.round(maxTokens * 1.5), 32_000);
      continue;
    }
    const issues = p.check ? p.check(parsed.data) : [];
    if (issues.length && attempt === 0) {
      lastIssues = issues;
      continue;
    }
    return parsed.data;
  }
  throw new ValidationFailure(`Structured output failed validation (${p.task})`, lastIssues);
}
