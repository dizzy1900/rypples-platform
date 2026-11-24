# The Rypples Platform: technical and prototype specification

This is the build specification for the Rypples Platform prototype. It is written for implementation in Claude Code and deployment on Vercel from the public repo `dizzy1900/rypples-platform`.

This file is the index. The detail lives in `docs/`, one file per area, so each area can be loaded on its own.

---

## 1. What this is

A working web app that answers the Rypples challenge: *how would you design, build and productise a platform that helps Anchor-stage ocean companies clear their critical growth constraints, as a repeatable model?*

One data model serves two products:

| Product | Who uses it | Demo identity |
|---|---|---|
| **Rypples OS** | The Rypples team only. Decisions, portfolio, Playbook, operating partners, founder programs, pipeline, investor relations. | Jerome Ternynck, Co-founder & CEO |
| **Rypples Engine** | Founders of Anchor companies. Board pack, plan, capital, programs, and a ledger of what Rypples owes them. | Adri Pols, CEO of Desolenator |

**Captain** is the AI layer across both products. Every agent's work surfaces through it. You can query it directly, and it answers with sources. It reaches the platform's records and connected tools through one tool registry, which is also published as a public MCP server.

**Scenario:** Rypples led Desolenator's next round on 15 Oct 2026 and took a board seat. The scenario date defaults to Monday 23 Nov 2026, which is day 39 of the first 100 days. Facts about the portfolio, Desolenator and WSense come from public sources. Every illustrative figure is marked as illustrative. See `docs/01-product.md` §4.

**Product principle:** the platform gives the Rypples team and its founders leverage. It does not rebuild tools that are already best in class, such as data rooms, CRM, document storage or meeting notes. It connects to them through native MCP and adapters, and brings their data together. This is not another data room.

---

## 2. Signature moments

Each moment must work end to end on the public URL. Moments 1 to 7 are the ones Jerome should remember.

| # | Moment | Where | Detail |
|---|---|---|---|
| 1 | **Run it on any ocean company.** Type a name or URL. A live diagnostic comes back with citations: eight domains, binding constraint, programs, lessons, three questions. | OS → Diagnostic → Any company | `docs/06-screens.md` S5b, `docs/07-ai.md` F2 |
| 2 | **Signed becomes day one.** Drag Project Tern to Led. This generates the 100-day plan, Growth Engine allocation, operating partner match (with a capacity check), schedule, and Tern's founder workspace in Engine. | OS → Pipeline | S8, F7 |
| 3 | **Real data behind the constraint.** Desolenator's target markets are ranked by water stress (WRI Aqueduct 4.0) and solar resource (NASA POWER), with the pilots pinned on the map. | OS → Desolenator → Market evidence. Engine → Plant capital | S4, `docs/09-geodata.md` |
| 4 | **The Playbook gets faster.** A firm-level learning curve shows days to clear each constraint as cases build up. A replay of WSense from 2023 to 2026 shows how the platform would have read each step. | OS → Investor relations → Acceleration. OS → Playbook | S9, S6 |
| 5 | **Rypples inside Jerome's own Claude.** A read-only remote MCP server over the public demo data. Add it as a connector and ask questions. | `/api/mcp`, `/connect` | `docs/08-mcp-and-integrations.md` |
| 6 | **The Growth Engine schedule.** The one-page term-sheet annex, generated per company. | OS → Company → Schedule. Engine → How Rypples works | S4c, S14 |
| 7 | **One brand ripple.** A single WebGL water ripple, only when a lesson is sent, spreading to the companies receiving it. | OS → Playbook | `docs/02-design-system.md` §9 |
| 8 | Board pack in, diagnostic out, every score cited | OS → Desolenator → Diagnostic | S5a, F1 |
| 9 | Founders rate Rypples, and Jerome sees it | Engine Home, OS Company | S11 |
| 10 | Ask Captain anything, with sources, and see what it did overnight | Captain drawer | S10, F3 |
| 11 | Engine drafts the founder's board pack | Engine → Board pack | S12, F5 |
| 12 | Traceable shareholder reporting | OS → Investor relations | S9, F6 |

---

## 3. Documents

| File | Covers |
|---|---|
| `docs/01-product.md` | Users, principles, naming, scenario and honesty labelling, scope, what is not built |
| `docs/02-design-system.md` | Tokens from rypples.earth, typography, components, layout, motion, the ripple, phone width, accessibility, design constraints |
| `docs/03-architecture.md` | Stack, repo layout, module boundaries, runtime, demo sessions, path to the production platform |
| `docs/04-data-model.md` | Entities, tables, the event log, projections, demo-session overlays |
| `docs/05-seed-data.md` | Every seeded record: the real public data with sources, and the illustrative data |
| `docs/06-screens.md` | All routes and screens: layout, data, every control and what it does, states, acceptance criteria |
| `docs/07-ai.md` | Claude integration: models, the seven AI flows, prompts, schemas, citations, guardrails, streaming, fallbacks |
| `docs/08-mcp-and-integrations.md` | Tool registry, public MCP server, `/connect`, integration adapters |
| `docs/09-geodata.md` | Market evidence: Aqueduct and NASA POWER pipeline, scoring, map |
| `docs/10-security-cost-ops.md` | Spending cap, rate limits, cached mode, priority token, environment, Vercel config, observability |
| `docs/11-testing-and-evals.md` | Unit, integration, end-to-end, visual and AI evals. Release checklist |

---

## 4. Routes at a glance

| Route | Screen |
|---|---|
| `/` | S0 Welcome (two doors: Rypples OS, Rypples Engine) |
| `/os` | S1 Jerome's home |
| `/os/portfolio` | S2 Portfolio |
| `/os/companies/[slug]` | S4 Company record (full for Desolenator; standard for the others) |
| `/os/companies/[slug]/diagnostic` | S5a Diagnostic, portfolio pack |
| `/os/companies/[slug]/schedule` | S4c Growth Engine schedule |
| `/os/diagnostic/new` | S5b Run on any ocean company |
| `/os/diagnostic/runs/[runId]` | S5b result, shareable |
| `/os/playbook` | S6 Playbook |
| `/os/operating-partners` | S7 Operating partners (CRM table, funnel, record sheet via `?partner=`) |
| `/os/founder-programs` | S7b Founder programs (tabs: readiness, scalers). `/os/growth-engine` redirects here or to S7 |
| `/os/pipeline` | S8 Pipeline |
| `/os/investor-relations` | S9 Investor relations (tabs: update, impact, paths, acceleration). `/os/reporting` redirects |
| any `/os/*` with `?captain=1` | S10 Captain drawer |
| `/engine/[slug]` | S11 Engine home (`/bridge` URLs redirect) |
| `/engine/[slug]/board-pack` | S12 Board pack |
| `/engine/[slug]/capital` | S13 Plant capital and customers |
| `/engine/[slug]/how-rypples-works` | S14 How Rypples works with you |
| `/engine/[slug]/schedule` | S4c schedule, founder view |
| `/connect` | MCP connection page |
| `/api/mcp` | Public MCP endpoint (Streamable HTTP) |

---

## 5. Stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui themed to Rypples tokens · Framer Motion · pnpm · InsForge (Postgres) as system of record · Redis for budget, rate limits and cache · Anthropic TypeScript SDK · `@modelcontextprotocol/sdk` · zod · d3-geo · Playwright and Vitest · Vercel.

---

## 6. Definition of done

- Every route in §4 renders from data on the deployed Vercel URL, at desktop and phone widths.
- Every visible control does what `docs/06-screens.md` says. If it can't, it is removed. There are no dead buttons or `href="#"`.
- Each signature moment in §2 works end to end on the deployed URL in live mode. Each also works in cached mode with `LIVE_AI=off`.
- Every AI output shown to a user carries its sources or record references, and nothing an agent drafts counts until a person approves it.
- Every illustrative figure renders with the illustrative marker. Every public fact has a source in `sources`.
- The spending cap, rate limits and cached fallback behave as in `docs/10-security-cost-ops.md`.
- The test and eval suites in `docs/11-testing-and-evals.md` pass.
- A visitor's clicks change only their own demo session. **Reset demo** restores the seeded state.
