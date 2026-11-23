# The Rypples Platform

A working prototype of the platform behind Rypples' Growth Engine. One data model serves two products: **Rypples OS** for the Rypples team (decisions, portfolio, Playbook, Growth Engine, pipeline, reporting) and **Rypples Bridge** for the founders of Anchor companies (board pack, plan, capital, programs, and a ledger of what Rypples owes them). **Captain** is the AI layer across both: every agent's output is a proposal with sources, and nothing counts until a person approves it. The same tools Captain uses are published as a read-only MCP server.

**Live:** _URL added after the first Vercel deploy_

**Real vs illustrative.** The scenario (Rypples leading Desolenator's round on 15 Oct 2026, with a board seat) is fictional. Portfolio facts about Desolenator, WSense and the other companies come from public sources, linked wherever they appear. Every illustrative figure renders with a dotted underline.

**Stack.** Next.js 15 · TypeScript · Tailwind CSS v4 · InsForge (Postgres) · Redis · Anthropic Claude (Haiku, Sonnet and Opus 5.5) · Model Context Protocol · d3-geo · Vitest and Playwright · Vercel.

## Run it locally

```bash
pnpm i
cp .env.example .env.local   # works with no keys: AI flows replay recorded runs
pnpm db:seed                 # only when InsForge is configured
pnpm dev
```

Use Rypples from your own Claude: `claude mcp add --transport http rypples <site>/api/mcp`.

## Data attributions

- Water stress: WRI Aqueduct 4.0, CC BY 4.0 (aqueduct.wri.org)
- Solar resource: NASA POWER (power.larc.nasa.gov)
- Country boundaries: Natural Earth, via world-atlas

The build specification is in [`docs/`](docs/SPEC.md).
