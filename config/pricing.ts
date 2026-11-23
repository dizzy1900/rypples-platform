/**
 * Token prices per model, USD per million tokens (docs/10-security-cost-ops.md §2).
 * Source: Anthropic's published Claude API pricing as cached by the claude-api skill on 2026-11-03
 * (first-party rates). Cache writes are 1.25× input for the 5-minute TTL and 2× for 1 hour.
 * Haiku 5.5 is $0.50 / $2.50 above 100K-token prompts; flows here never send prompts that long.
 * There are no defaults in code: a model without a row here cannot be costed, and the unit test fails.
 */
export type ModelPrice = {
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
};

export const PRICING: Record<string, ModelPrice> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2 },
  // Server-side refusal fallback targets (`fallbacks: "default"` may route here; rarely billed).
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.2 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite5m: 6.25, cacheWrite1h: 10, cacheRead: 0.5 },
};

/** Web search: $10 per 1,000 searches. Web fetch has no charge beyond tokens. */
export const WEB_SEARCH_USD_PER_REQUEST = 0.01;

export function priceFor(model: string): ModelPrice | null {
  return PRICING[model] ?? null;
}
