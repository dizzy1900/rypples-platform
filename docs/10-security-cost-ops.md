# 10 · Security, cost and operations

The URL is open to anyone with the link, by decision. Every paid call is therefore metered, capped and replaceable by a cached result. Jerome should never meet a broken screen or a visible limit during normal use.

## 1. Modes

| Mode | When | Behaviour |
|---|---|---|
| `live` | Default | Flows call the API. Results are persisted and cached |
| `cached` | The total budget is reached, `LIVE_AI=off`, or the API is erroring (circuit open) | Flows replay precomputed or cached results through the same UI. F2 accepts only already-cached companies. Captain answers the suggested prompts from precomputed answers and, for other questions, shows "Live answers are paused for today. Try one of these." with the prompt chips |

`lib/ai/budget.ts` exports `getMode(flow, ctx)`. It is called before every flow, and the result is sent as the first SSE event.

## 2. Spending cap

- **Estimate the cost** of each call from `usage` (input, output, cache-read and cache-write tokens), plus `server_tool_use.web_search_requests` × $0.01. Web search is $10 per 1,000 searches on the Claude API, and web fetch has no extra charge beyond tokens.
- **Token prices** live in `config/pricing.ts`, per model. Set them from Anthropic's current pricing page at build time; there are no defaults in code. A unit test fails if any configured model lacks a price.
- **Total spend** is the larger of two figures:
  - `spend:total` in Redis (or the in-process fallback), incremented atomically after each call;
  - the sum of `agent_runs.est_cost_usd` in the data store. This is durable and shared across Vercel instances, and `pnpm precompute` and `pnpm evals` write their runs there too.
- **Daily counters** `spend:{YYYY-MM-DD}` and `spend:flow:{flow}:{date}` are kept for `/os/_status` only.
- **Caps** (env):
  - `AI_TOTAL_BUDGET_USD` (suggested 25): a lifetime cap for the key, not a daily one.
  - `AI_PRIORITY_RESERVE_USD` (suggested 10): public visitors stop at the total minus this reserve; only the priority link can use the rest.
  - `AI_F2_DAILY_RUNS` (suggested 60).
  - **Soft limit at 80% of the public share:** F2 "Run again" is disabled, but new companies are still allowed.
  - **Hard limit at the total:** cached mode for everyone until the cap is raised.
  - The cap is an estimate from `usage`. The hard backstop is on the Anthropic side: a prepaid credit balance with auto-reload off, or a spend limit on a dedicated workspace.
- **Circuit breaker:** 5 consecutive API errors in 2 minutes switches to cached mode for 10 minutes.

## 3. Rate limits (per hashed IP, Redis sliding window)

| Surface | Limit |
|---|---|
| F2 new runs | 4 per hour, 12 per day |
| F2 "Run again" | 2 per day |
| Captain messages | 30 per hour |
| F1, F5, F6, F7 | 10 per hour each |
| `/api/mcp` | 120 requests per minute |

When a limit is hit, the UI shows "You've run a lot of these. Here's a recent run." with cached alternatives. It never shows a raw 429. IPs are hashed with a server salt (`IP_HASH_SALT`) and never stored in plain text.

## 4. Priority token for the interview

`DEMO_PRIORITY_TOKEN` (env): visiting any URL with `?k=<token>` sets an httpOnly cookie, `rp_priority` (7 days). Priority sessions:

- bypass per-IP limits;
- can use the `AI_PRIORITY_RESERVE_USD` part of the total after public visitors have used their share;
- see no visual difference.

Use this link in the shared summary for Jerome, and on the call.

## 5. Abuse and safety

- **Input limits:**
  - F2 query: 200 characters.
  - Captain: 1,000 characters.
  - Free-text fields: 2,000 characters.
  - MCP request body: 64 KB.
- Strip control characters. Treat everything retrieved from the web as untrusted data (`docs/07-ai.md` §6).
- No user content is ever rendered as HTML. Markdown from AI renders through a sanitiser with an allowlist: paragraphs, lists, emphasis, links with `rel="noopener noreferrer"`.
- Security headers in `next.config.ts`: a strict CSP (self plus Google Fonts if not self-hosted; no inline scripts except Next's nonce), `frame-ancestors 'none'`, `referrer-policy: strict-origin-when-cross-origin`, `x-content-type-options: nosniff`.
- No secrets in client bundles. `lib/env.ts` separates server and public env, and the build fails if a server variable is imported client-side.
- The data is public or illustrative. No personal data is collected, and there is no analytics beyond Vercel's aggregate Web Analytics, if enabled.

## 6. Environment variables

| Name | Scope | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | server | Claude API |
| `MODEL_FAST`, `MODEL_MAIN`, `MODEL_DEEP` | server | Model overrides (`docs/07-ai.md` §1) |
| `INSFORGE_BASE_URL` | server | InsForge project URL |
| `INSFORGE_SERVICE_KEY` | server | Server-side key for repository access (name per InsForge docs) |
| `REDIS_URL` (or Upstash REST URL and token) | server | Budget, limits, cache |
| `LIVE_AI` | server | `on` or `off` |
| `AI_TOTAL_BUDGET_USD`, `AI_PRIORITY_RESERVE_USD`, `AI_F2_DAILY_RUNS` | server | Caps |
| `DEMO_PRIORITY_TOKEN` | server | Interview priority link |
| `IP_HASH_SALT` | server | Hashing |
| `SCENARIO_DATE` | server | Scenario clock (a Monday) |
| `NEXT_PUBLIC_SITE_URL` | public | Absolute links, `/connect`, MCP refs |

`.env.example` lists every variable with a comment. `lib/env.ts` validates them at startup and fails fast with a readable message.

## 7. Vercel configuration

- Node.js runtime for `app/api/ai/*` and `app/api/mcp`, with `maxDuration` set per route (F2 120 seconds; the others 60). Confirm the plan's function duration limit before release.
- Set the region close to the InsForge project region.
- Preview deployments use `LIVE_AI=off` by default, so previews never spend.
- Production: set every env var, then run `pnpm db:seed` against the production InsForge project once.

## 8. Observability

- `agent_runs` records every flow: mode, model, prompt version, usage, estimated cost, duration and status.
- A `/os/_status` page (not in navigation) is unlocked only with the priority cookie. It shows total spend versus the cap, the runs per flow, the current mode, the circuit state and the last 20 errors. It is read-only.
- Structured server logs (JSON) with `run_id` for each flow. No prompt or response bodies are logged.
- Vercel Web Analytics may be enabled for page-level traffic. Nothing else.

## 9. Reset and housekeeping

- **Reset demo** rotates the visitor's session (`docs/03-architecture.md` §5).
- `pnpm sweep:sessions` is a manual script that deletes session-scoped rows and events older than 7 days. It is not scheduled.
- `pnpm db:reseed` drops and reloads the seed in a target environment (requires `--confirm`).
