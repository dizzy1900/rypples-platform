# 11 · Testing and evals

All suites run with `pnpm test` (unit and integration), `pnpm e2e` (Playwright) and `pnpm evals` (AI). CI runs unit, integration and end-to-end tests on every push, with `LIVE_AI=off` and the fixture repository. Evals run locally with a real key, and their reports are committed to `evals/reports/`.

## 1. Unit (Vitest, `tests/unit`)

| Area | Assertions |
|---|---|
| `lib/scenario` | Day 39 on 2026-11-23; startup rejects a non-Monday `SCENARIO_DATE`; relative offsets resolve to the right weekday |
| `lib/domain/portfolio-stats` | All derived checks in `docs/05-seed-data.md` §3 (stuck counts 5/4/2, over benchmark 2, backed 13, firm rating 4.4) |
| `lib/domain/benchmarks` | Outside source below 8 cases and Rypples median at 8 or more (synthetic 8-case fixture); rolling median window 4 on the 14 seeded cases |
| `lib/domain/capacity` | Firm capacity 844 / 1,120 (active experts and specialists only); FE tightest; F7 allocation outcome (Key Hire and Pilot to Contract start, Finance Sprint deferred because FE has 30h left; the Maritime board-level candidate moves to onboarding for Tern) |
| `lib/domain/program-map` | Every intent maps to exactly one program |
| `lib/geo/score` | Weight normalisation; tie-breaks; deterministic ranking for a fixed fixture; the 2030 toggle swaps the indicator |
| Projections | Seed plus events fold correctly for each event type in `docs/04-data-model.md` §11; another session's events never leak |
| Seed validation | Every seed file parses with its zod schema; every `public` row has a `source_id` that exists; no `illustrative` value is rendered without the marker (component test) |
| AI schemas | zod ↔ JSON Schema round trip; validators reject unknown evidence IDs, missing evidence for non-null scores, and figures in F6 text segments |
| Guardrails | The numeric grounding check flags untraced numbers and accepts formatted equivalents (1,120 vs 1120; 4.4 vs 4.40) |
| Pricing config | Every configured model has prices |

## 2. Integration (`tests/integration`)

- Repositories: the InsForge implementation and the fixture implementation pass the same contract test suite, run against a disposable InsForge project when `INSFORGE_TEST_URL` is set.
- Tool registry: each tool returns `refs`; the founder viewer cannot read another company (try every tool with a foreign slug and expect a scope error); PublicViewer never returns session rows.
- MCP: start the route handler, connect with the SDK client, list tools (only public, read-only ones), and call each tool with valid and invalid input.
- SSE: each flow route in replay mode emits a valid `FlowEvent` sequence ending in `result`.
- Budget: simulated spend crosses 80% (soft) and then 100% (hard), giving cached mode; the priority cookie bypasses limits up to its own budget; the circuit opens after 5 errors.

## 3. End to end (Playwright, `tests/e2e`, desktop 1440×900 and phone 390×844)

The core journeys run in replay mode, so they are deterministic:

1. **Welcome → OS → Home:** counts render; open Captain with ⌘K; the seeded exchange is visible; a chip navigates to Portfolio.
2. **Portfolio:** filter Maritime (rows dim, stats recalculate); toggle to the constraint map; open Vessev (S4-standard).
3. **Desolenator:** every tab renders. Market evidence: move the water slider to 80 and check the top 3 change as the unit fixture predicts. Resolve the decision, then check Home shows 2 open.
4. **Diagnostic S5a:** run (replay); 8 domains appear; open an evidence popover; confirm the constraint.
5. **Any company S5b:** mocked streams for each outcome (ok, declined, ambiguous, insufficient, error); "Add to pipeline" creates a sourced codename deal.
6. **Playbook:** send is blocked before approval; approve; send to Desolenator; the ripple canvas mounts then unmounts (and is skipped under reduced motion); the replay steps through 4 dates.
7. **Pipeline → day one:** drag Tern to Led with the mouse, and separately use the keyboard path ("Mark as led"); F7 replay; result panel values; `/engine/tern` renders; Home shows 14; the rail lists Tern; Reset removes everything.
8. **Engine:** rate commitment l2 and check the rating shows on S4; dispute the constraint and check the decision appears on S1; the WSense lesson appears after it's sent; the board pack can't be shared until sections are ready; F5 replay drafts the letter; share, then check S4 Board history updates.
9. **Capital:** shortlist toggles; pilot stage confirmation feeds the board pack pilots section.
10. **How Rypples works:** requesting a program raises "used" to 3, after which the remaining buttons are disabled.
11. **Investor relations:** a reference popover resolves; the Acceleration chart renders; the People domain filter shows 5 of 8.
12. **Connect:** the URL copies; the tool list renders.
13. **Session isolation:** two browser contexts. Actions in A are not visible in B.

Run axe on every route at both widths, with zero serious or critical violations. Take visual snapshots of each route at both widths as a regression baseline, refreshed only on intended design changes.

## 4. AI evals (`pnpm evals`, `evals/`)

Golden cases are versioned alongside the prompts. Each case has inputs, assertions and a report.

| Flow | Cases | Assertions |
|---|---|---|
| F1 | Desolenator pack | Every non-null score has ≥1 valid evidence ID resolving to a snapshot span; binding domain = financing (expected, given the pack); AI adoption null; 3 questions; tone check passes |
| F2 | 12 portfolio companies; 6 other ocean companies; 3 non-ocean companies (e.g. a SaaS firm, a bakery, a bank) that must be declined; 1 ambiguous name; 1 obscure company that must return insufficient | Relevance-check accuracy 100% on declines; no binding constraint when status is insufficient; ≥80% of scored domains carry ≥2 evidence items; no financial speculation (regex and a judge prompt for "revenue/valuation/burn/runway" claims not in evidence); no statement about a real company without a citation (judge) |
| F3 | The 4 suggested prompts plus 10 portfolio questions plus 4 founder-scope probes ("What's Vessev's constraint?" asked as Adri) | Zero untraced numbers; ≥1 ref per factual answer; low-confidence caveat present when a tool returned low confidence; founder probes refused without leaking |
| F4 | WSense lesson | Exactly the eligible set considered; reasons cite a specific company fact; no exited or source company |
| F5 | Letter and asks for Desolenator | No currency amounts or percentages absent from the context; ≤300 words; first person |
| F6 | Q4 update | All refs resolve; no digits in text segments; held-back records listed |
| F7 | Tern | Binding domain = operations; 3 priorities with valid intents; deterministic outcomes match the unit expectations |

**Judges:** a separate `MODEL_MAIN` call with a rubric prompt returning a structured verdict, used only for tone and "uncited claim" checks. Reports include pass rates, failures with excerpts, and the cost of the eval run.

**Regression rule:** a new prompt version must match or beat the current version on every flow's assertions before `lib/ai/prompts/index.ts` points to it.

## 5. Release checklist

- [ ] `pnpm test`, `pnpm e2e` and `pnpm evals` are green. The eval report is committed.
- [ ] Every F2 precomputed file that is displayed has been read by a person and marked `reviewed: true`.
- [ ] Source snapshots are reviewed, and all `verify` notes in `docs/05-seed-data.md` are resolved (sourced, corrected or reclassified as illustrative).
- [ ] `data/geo/markets.json` has been built, with attribution dates.
- [ ] Production env vars are set, `pnpm db:seed` has run, and `SCENARIO_DATE` is set.
- [ ] Live-mode smoke test on the production URL with the priority link: F1, one new F2 company, a Captain question, and F7.
- [ ] Cached-mode smoke test with `LIVE_AI=off` on a preview.
- [ ] The MCP Inspector session passes. A Claude Code session with the four `/connect` questions passes.
- [ ] Phone-width pass on a real device.
- [ ] The README is accurate. Placeholders for the logo and photos are swapped if the assets were supplied.
