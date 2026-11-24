# 03 · Architecture

The prototype is built so the real platform can grow from it without a rewrite. These choices make that possible:

- one domain model, with `firm_id` everywhere;
- an append-only event log;
- repositories behind interfaces;
- one tool registry shared by Captain and the MCP server;
- adapters for every outside system;
- AI outputs stored as proposals with provenance;
- versioned prompts and schemas with evals.

## 1. Stack

| Concern | Choice |
|---|---|
| App | Next.js 15 App Router, React Server Components by default, TypeScript `strict` |
| Styling | Tailwind CSS v4 with `@theme` tokens (`docs/02-design-system.md`), shadcn/ui primitives restyled |
| Motion | Framer Motion (drawer, streamed reveal, tab underline only) |
| Data | InsForge (Postgres 15, PostgREST, row-level security, pgvector available) via `@insforge/sdk` on the server only |
| Cache, budget, rate limits | Redis (`REDIS_URL`; Upstash via the Vercel Marketplace works) |
| AI | Anthropic TypeScript SDK (`@anthropic-ai/sdk`), server-side only |
| Validation | zod (v4) for every boundary: env, route inputs, AI outputs, seed files |
| MCP | `@modelcontextprotocol/sdk` (Streamable HTTP transport, stateless) |
| Geo | d3-geo plus topojson-client, Natural Earth 1:110m countries |
| Dates | date-fns |
| Tests | Vitest (unit, integration), Playwright (end-to-end, visual, axe) |
| Package manager | pnpm |
| Hosting | Vercel (Node.js runtime for AI and MCP routes) |

## 2. Repository layout

```
/
├─ app/
│  ├─ page.tsx                         # S0 Welcome
│  ├─ connect/page.tsx                 # MCP connect page
│  ├─ os/
│  │  ├─ layout.tsx                    # OS shell: rail, sheet, top bar, Captain drawer host
│  │  ├─ page.tsx                      # S1 Home
│  │  ├─ portfolio/page.tsx            # S2
│  │  ├─ companies/[slug]/page.tsx     # S4
│  │  ├─ companies/[slug]/diagnostic/page.tsx   # S5a
│  │  ├─ companies/[slug]/schedule/page.tsx     # S4c
│  │  ├─ diagnostic/new/page.tsx       # S5b input
│  │  ├─ diagnostic/runs/[runId]/page.tsx       # S5b result
│  │  ├─ playbook/page.tsx             # S6
│  │  ├─ operating-partners/page.tsx   # S7
│  │  ├─ founder-programs/page.tsx     # S7b
│  │  ├─ pipeline/page.tsx             # S8
│  │  └─ investor-relations/page.tsx   # S9
│  ├─ engine/[slug]/
│  │  ├─ layout.tsx                    # Engine shell
│  │  ├─ page.tsx                      # S11
│  │  ├─ board-pack/page.tsx           # S12
│  │  ├─ capital/page.tsx              # S13
│  │  ├─ how-rypples-works/page.tsx    # S14
│  │  └─ schedule/page.tsx             # S4c founder view
│  ├─ api/
│  │  ├─ ai/diagnostic/route.ts        # F1 SSE
│  │  ├─ ai/any-company/route.ts       # F2 SSE
│  │  ├─ ai/captain/route.ts           # F3 SSE
│  │  ├─ ai/lesson-match/route.ts      # F4
│  │  ├─ ai/board-pack/route.ts        # F5 SSE
│  │  ├─ ai/shareholder-update/route.ts# F6 SSE
│  │  ├─ ai/day-one/route.ts           # F7 SSE
│  │  ├─ mcp/route.ts                  # public MCP server
│  │  └─ demo/reset/route.ts
│  └─ globals.css
├─ components/
│  ├─ ui/                              # restyled shadcn primitives
│  └─ rypples/                         # domain components (ScoreBar, LedgerRow, MarketMap, …)
├─ lib/
│  ├─ env.ts                           # zod-validated env
│  ├─ scenario.ts                      # scenario clock, day counting
│  ├─ viewer.ts                        # Viewer resolution from route + demo session
│  ├─ domain/                          # types, zod schemas, taxonomy, pure functions
│  │  ├─ schemas/*.ts
│  │  ├─ capacity.ts                   # operator capacity and allocation checks
│  │  ├─ benchmarks.ts                 # benchmark source selection, learning curve
│  │  ├─ lifecycle.ts
│  │  └─ portfolio-stats.ts            # derived counts (stuck-by-constraint, over benchmark, ratings)
│  ├─ data/
│  │  ├─ repository.ts                 # Repository interfaces
│  │  ├─ insforge/                     # Postgres implementation via @insforge/sdk
│  │  ├─ fixture/                      # in-memory implementation over data/seed (tests, offline)
│  │  ├─ events.ts                     # append + read the event log
│  │  └─ projections/                  # state = seed + session events
│  ├─ ai/
│  │  ├─ client.ts                     # Anthropic client, model config per flow
│  │  ├─ prompts/<flow>/v<n>.md        # versioned prompt files
│  │  ├─ schemas/<flow>.ts             # zod output schemas → JSON Schema
│  │  ├─ flows/<flow>.ts               # orchestration per flow (F1–F7)
│  │  ├─ evidence.ts                   # citation → Evidence record conversion
│  │  ├─ guardrails.ts                 # relevance check, numeric grounding check, tone check
│  │  ├─ budget.ts                     # spend estimate, cap, cached-mode switch
│  │  └─ sse.ts                        # typed server-sent event helpers
│  ├─ tools/                           # ONE registry used by Captain (in-process) and MCP
│  │  ├─ registry.ts
│  │  └─ <tool>.ts
│  ├─ integrations/                    # adapter interfaces + demo adapters
│  │  ├─ types.ts
│  │  └─ demo/*.ts
│  ├─ geo/                             # market scoring
│  └─ redis.ts
├─ data/
│  ├─ seed/*.json                      # every seeded record (docs/05-seed-data.md)
│  ├─ sources/*.md                     # text snapshots of public sources, with URL + accessed date
│  ├─ geo/markets.json                 # derived market indicators (docs/09-geodata.md)
│  ├─ geo/countries-110m.json          # Natural Earth topojson
│  └─ precomputed/*.json               # cached AI outputs used for fallback and "overnight" work
├─ db/migrations/*.sql
├─ scripts/
│  ├─ seed.ts                          # loads data/seed into InsForge
│  ├─ snapshot-sources.ts              # fetches and stores public source text
│  ├─ build-geo.ts                     # builds data/geo/markets.json
│  ├─ precompute.ts                    # runs AI flows and writes data/precomputed
│  └─ evals.ts
├─ evals/                              # golden cases and assertions
├─ tests/{unit,integration,e2e}/
├─ public/{brand,people}/
└─ docs/                               # this specification
```

## 3. Module boundaries

- `app/*` reads only through `lib/data` (repositories and projections) and writes only through **server actions** in `app/**/actions.ts`, which append events. Pages never call InsForge or Anthropic directly.
- `lib/domain` is pure: no I/O, fully unit-tested. Derived numbers shown on screens (counts, "2 over benchmark", average rating, capacity) are computed here from records, never hardcoded in JSX.
- `lib/ai/flows` depends on `lib/data`, `lib/tools`, `lib/ai/*`. It never imports from `app`.
- `lib/tools` is the only place agent-callable capabilities are defined. Captain and the MCP server both consume the registry (`docs/08-mcp-and-integrations.md`).
- `lib/integrations` hides every outside system behind an interface. Demo adapters return fixtures. Real adapters slot in without changing callers.

Module dependency order: `domain` → `data` → `tools` and `integrations` → `ai` → `app`.

## 4. Rendering and data flow

- Screens are server components that load a projection for the current `Viewer` and demo session, then render. Interactive islands (tabs, ratings, drag, drawers, streaming panels) are client components that receive serialisable props.
- Mutations: client → server action → validate with zod → `events.append(...)` → `revalidatePath` for affected routes → the UI reflects the new projection. Optimistic UI only for ratings and toggles.
- AI flows: client opens an SSE stream (`fetch` with `ReadableStream`, not `EventSource`, so POST bodies work) → the flow emits typed events (`step`, `evidence`, `score`, `token`, `result`, `error`, `fallback`) → the final result is persisted as a `proposal` (or `run`) record → the UI renders from the stream and then from the stored record.

## 5. Demo sessions

The URL is public and open, so one visitor must never see another visitor's clicks.

- On first request, middleware sets an httpOnly cookie `rp_demo` with a random `session_id` (30-day expiry).
- Every event written by a visitor carries `session_id`. Seed data has `session_id = null`.
- Projections read `seed ∪ events where session_id = current`. Seed records are never mutated.
- **Reset demo:** a quiet text link in the footer and in the profile menu. It calls `POST /api/demo/reset`, which rotates the session id, so the old events are orphaned and swept after 7 days by a manual script (no scheduled job).
- AI results that are expensive and not visitor-specific (any-company runs, keyed by normalised domain) are stored without `session_id` and shared, so repeat lookups are cached for everyone.
- Signed → day one (F7) creates session-scoped records (a new company, plan, allocation, Engine workspace) only in that visitor's session.

## 6. Viewer and permissions

```ts
type Viewer =
  | { kind: "rypples"; firmId: string; personId: "jerome" }
  | { kind: "founder"; firmId: string; companyId: string; personId: string };
```

- `/os/*` resolves to the Rypples viewer. `/engine/[slug]/*` resolves to that company's founder.
- Every repository method and every tool takes a `Viewer` and enforces scope:
  - A founder sees their own company, lessons sent to them, programs, public portfolio facts and their Ocean Scalers circle (themes only).
  - A founder never sees Rypples OS records: other companies' diagnostics, ratings of others, pipeline, capacity, internal decisions or the shareholder update.
- Row-level security policies in InsForge mirror this, keyed on `firm_id` and `company_id`, so real auth (JWT claims) replaces the door without changing queries.

## 7. Runtime and deployment

- AI and MCP routes run on the Node.js runtime. Set `export const maxDuration` on long routes (F2 needs about 120 seconds; F1, F5, F6 and F7 about 60). Confirm the Vercel plan's function duration limit supports this. If not, raise the plan or shorten the F2 research budget.
- Static and seed-derived pages use ISR with tag revalidation on events. Session-dependent pages render dynamically.
- Secrets live only in Vercel env vars (see `docs/10-security-cost-ops.md` §6). Nothing secret is exposed to client components.
- Fonts and the topojson are self-hosted (`next/font`, `/data/geo`).

## 8. Path to the production platform

The real platform grows from here without changing the model:

| Prototype | Production |
|---|---|
| Two doors and a `Viewer` from the route | InsForge auth (SSO for the Rypples team, magic link for founders). `Viewer` from JWT claims. Same RLS |
| Demo adapters (Drive, CRM, meeting notes, finance) | Real MCP clients or API adapters behind the same interfaces |
| Seeded "overnight" Captain work | The same flows triggered by events (board pack uploaded, meeting notes synced) through a job runner |
| Session overlays | Removed. Events are written with real actors |
| Public read-only MCP over demo data | Authenticated MCP (OAuth) over the firm's data, scoped by `Viewer` |
| One firm | `firm_id` is already on every table. Multi-firm is a configuration change, not a migration |
| Outside benchmarks | Rypples' own benchmarks once a constraint has 8 cleared cases (logic already in `lib/domain/benchmarks.ts`) |
