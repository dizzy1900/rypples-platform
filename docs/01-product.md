# 01 · Product

## 1. The problem this answers

Ocean companies stall between pilot and scale. Rypples leads Anchor rounds with a board seat and a minority stake. Its Growth Engine (operators, programs and know-how) exists to help those companies get further, faster, and its job is to add value, not take over.

The platform makes that service a **product**:

- **Find the one constraint that matters.** A cited diagnostic across eight domains proposes the binding constraint, and a person confirms it.
- **Deliver the help that clears it.** Named programs with defined outcomes. An allocation written into every Anchor term sheet. Operating partners matched with a capacity check. A two-way ledger of commitments.
- **Learn from every company.** Lessons from board meetings, partner sessions and founder circles enter the Playbook and travel to the companies they fit. Benchmarks shift from outside references to Rypples' own data.
- **Make it repeatable.** One lifecycle for every company: Day 0 → first 100 days → quarterly loop → strategic path. Pipeline diligence produces the day-one plan.

## 2. Users and identities

| Identity | Product | Shown as | Notes |
|---|---|---|---|
| Jerome Ternynck, Co-founder & CEO | Rypples OS | Monogram "JT" in the rail, bottom left | Placeholder avatar until a photo is supplied (`public/people/jerome.jpg`) |
| Adri Pols, CEO, Desolenator | Rypples Bridge | Monogram "AP" | Placeholder until a photo is supplied |
| CEO, Project Tern (fictional) | Rypples Bridge | Monogram "PT" | Exists only after the Signed → day one moment |

There is no real authentication. The Welcome page has two doors, and the profile blocks switch between products (Jerome's profile opens Bridge; Adri's opens OS). Role is carried in the URL space (`/os` vs `/bridge/[slug]`). Permissions are enforced in the tool and data layer by a `Viewer` value (see `docs/03-architecture.md` §6) so that real auth can replace the door later.

## 3. Principles (shown on the Welcome page, and enforced in the build)

1. **One constraint at a time.** All help goes to what limits growth now. Each company has exactly one confirmed binding constraint.
2. **Founder-owned.** The plan belongs to the founder, and Rypples sees it. Founders choose their programs and can disagree with the constraint ("I see it differently").
3. **Evidence, not opinion.** Every score and finding links to its source. A domain without evidence shows "Evidence gap", never a guess.
4. **Agents draft, people decide.** Every AI output is a proposal with provenance (`status: proposed`). Nothing counts until a named person approves it.
5. **Measured both ways.** Founders rate everything Rypples delivers, and Jerome sees the ratings unfiltered.
6. **Integrate, don't rebuild.** Data rooms, CRM, documents, meeting notes and finance systems stay in best-in-class tools and are connected through MCP and adapters.

## 4. Scenario and honesty labelling

### 4.1 Scenario

- Rypples leads Desolenator's next round. It closed on **15 Oct 2026** and Rypples took a board seat. In reality Rypples does not hold Desolenator's board seat today.
- **Scenario date** = `SCENARIO_DATE` env var, default `2026-11-23`. All "today", day counts and "this week" values derive from it. Day in the first 100 = `differenceInCalendarDays(scenarioDate, roundClose)`: 15 Oct → 23 Nov = 39. Seeded dates that are relative to "today" (meetings this week, due dates) are stored as offsets from the scenario date, so moving `SCENARIO_DATE` keeps the week coherent. `SCENARIO_DATE` must be a Monday (validated at startup). Seeded week offsets assume it. Fixed historical facts (WSense timeline, round close) are absolute dates.
- Desolenator's board meets on **Thursday 26 Nov 2026**.
- Rypples has backed **13** companies: **12** are on the public portfolio (11 active, plus WSense, exited July 2026), and **1** is active but not yet announced.
- Pipeline deals are fictional codenames (Project Tern, Kelvin, Halyard, Ebb, Spinnaker and others).
- Operating partners are shown by role and monogram (BP, FE, GE, PE), never by invented names.

### 4.2 Labelling

Every number or statement falls into exactly one class. The class is stored on the record (`provenance`) and rendered consistently:

| Class | Example | Rendering |
|---|---|---|
| `public` | Desolenator's 40 m³/hour system; Fincantieri's majority stake in WSense | Plain text, plus a source chip where shown |
| `scenario` | Round closed 15 Oct; day 39; board seat | Plain text. The scenario banner and footers explain it |
| `illustrative` | Scores' exact values, days open, ratings, allocations, benchmarks, capacity | Dotted underline (`.ill`), tooltip "Illustrative figure" |
| `generated` | Live AI output | "Proposed · drafted by Captain" label and sources. Approval state shown |

**Persistent scenario note:** a single quiet line in the footer of every screen: "Demo scenario: Rypples leads Desolenator's next round. Public facts are sourced. Figures with a dotted underline are illustrative." It links to a short `/about` sheet (a modal on Welcome) explaining real vs illustrative.

**Tone for real companies:** diagnoses of real portfolio companies are written as constructive, evidence-led hypotheses from public sources. They never disparage, speculate about financials, or present a constraint as fact before confirmation. See `docs/07-ai.md` §6.

## 5. Naming and vocabulary

Use these terms exactly (they follow the job advert):

- **The Rypples Platform**: the whole product.
- **Rypples OS**: internal only. **Rypples Bridge**: for founders.
- **Captain**: the AI layer. Never "the agent page" or "AI assistant".
- **Growth Engine**: operators, programs and know-how. **Operating partners**: board partners and experts (Finance, Go-To-Market, People, Regulatory, Impact, independent technical).
- **Playbook** (inside Rypples OS). **Lesson**. **Ripple**: a lesson travelling to matched companies.
- **Ocean Scalers**: CEO peer circles. **Growth Readiness**: the five-module curriculum.
- **Ocean Impact Navigator**: the impact framework referenced for KPIs.
- **Binding constraint**, **diagnostic**, **domain**, **program**, **mission**, **commitment**, **ledger**, **allocation**, **schedule**.

**The eight domains** (constraint taxonomy, stored as data, `docs/05-seed-data.md` §2):
Commercial traction · Financing · Operations and delivery · Technology and reliability · Regulatory · People · AI adoption · Impact integrity.

Older labels in earlier mockups ("Growth trajectory", "Talent", "AI and data") map to Commercial traction, People and AI adoption. Use only the eight.

## 6. Scope

### In scope
All screens in `docs/06-screens.md`. The seven AI flows in `docs/07-ai.md`. The tool registry and public MCP server. Market evidence geodata. Demo sessions with reset. Phone-width layouts. The spending cap and cached mode.

### Not built (by decision)
- Authentication beyond the two doors and profile switching. Multi-firm tenancy (but `firm_id` is on every table).
- A data room, document store, CRM, meeting-notes tool or finance system. Connected tools are shown through demo adapters with fixture data, clearly labelled.
- Real integrations with Drive, Gmail or calendar. Notifications and email sending ("Send" actions record an event and show the result in-app).
- Scheduled or recurring jobs. "Overnight" Captain work is precomputed by `pnpm precompute` and seeded with timestamps.
- Portfolio economics, shared services, test sites.
- Valuation or ROI simulators, sentiment scoring of founders, voice features, decorative 3D.

## 7. Public README

`README.md` in the repo root is for anyone who opens the public repo, including Jerome. Keep it under 300 words, covering:

- One paragraph on what the Rypples Platform is.
- The live URL.
- A real vs illustrative note.
- The stack in one line.
- How to run it locally (`pnpm i`, `.env.local`, `pnpm db:seed`, `pnpm dev`).
- Data attributions: WRI Aqueduct (CC BY 4.0), NASA POWER, Natural Earth.

Keep agent instructions and rules out of root files.
