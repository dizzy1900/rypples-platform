# 05 · Seed data

Everything below goes into `data/seed/*.json`, validated by the zod schemas in `lib/domain/schemas`, and is loaded by `pnpm db:seed`.

**Provenance key:** **P** public (must have a `source_id`), **S** scenario, **I** illustrative.

When this file and the mockups disagree, this file wins. Never invent a public fact: if a public fact has no source in `sources`, the seed validator fails. Either add the source or reclassify the fact as **I**.

## 1. Firm, people, scenario

| id | Value | Prov. |
|---|---|---|
| firm `rypples` | Rypples | P |
| person `jerome` | Jerome Ternynck · Co-founder & CEO · JT | P |
| person `adri` | Adri Pols · CEO, Desolenator · AP | P |
| scenario | round close 2026-10-15 · board seat · `SCENARIO_DATE` default 2026-11-23 | S |
| Desolenator board meeting | offset +3 (Thu 26 Nov) | S |

## 2. Domains (taxonomy)

| sort | slug | label | note |
|---|---|---|---|
| 1 | commercial | Commercial traction | Sales and conversion |
| 2 | financing | Financing | Capital stack |
| 3 | operations | Operations and delivery | Deploy, build, operate |
| 4 | technology | Technology and reliability | Performance in the field |
| 5 | regulatory | Regulatory | Certification, permits |
| 6 | people | People | CEO and key hires |
| 7 | ai | AI adoption | AI in operations |
| 8 | impact | Impact integrity | Measured outcomes |

## 3. Portfolio (13 backed: 12 public, 1 unannounced)

Taglines, verticals and regions are **P** (source: rypples.earth/portfolio, source id `src_rypples_portfolio`). When authoring the seed, copy each company's outbound website link from its card on rypples.earth/portfolio into `website`.

Stage, binding constraint, days open, rating and next board are **I**, except where the company is Desolenator (scenario).

| slug | Name | Tagline | Vertical | Region | Stage | Constraint (domain) | Days open | Rates us | Next board |
|---|---|---|---|---|---|---|---|---|---|
| desolenator | Desolenator | Ultrapure water from the sea, powered by the sun | Ocean Health | Europe | First commercial | financing | 39 (S, from 15 Oct) | 4.5 | +3 (Thu 26 Nov) |
| vessev | Vessev | The hydrofoil that unlocks electric commercial vessels | Maritime | APAC | First commercial | commercial | 97 | 4.4 | 4 Dec |
| full-circle-biotechnology | Full Circle Biotechnology | The only fishmeal alternative that works commercially | Blue Foods | APAC | First commercial | operations | 118 | 4.0 | 2 Dec |
| hullbot | Hullbot | Continuous hull maintenance for cleaner shipping | Maritime | APAC | Repeatable sales | operations | 88 | 4.7 | 8 Dec |
| kelp-blue | Kelp Blue | Growing seaweed into the material of the future | Blue Foods | Europe | Pilots | operations | 74 | 4.2 | 3 Dec |
| matter | Matter | Pioneering microplastic filtration technology | Ocean Health | Europe | First commercial | commercial | 64 | 4.1 | 11 Dec |
| coral-vita | Coral Vita | The first scalable coral restoration platform | Ecosystems | Americas | First commercial | commercial | 58 | 4.6 | 9 Dec |
| sway | SWAY | The shortcut to replacing fossil plastics at scale | Blue Foods | Americas | First commercial | operations | 51 | 4.3 | 16 Dec |
| flocean | Flocean | Turning deep ocean pressure into freshwater | Ocean Health | Europe | Pilots | operations | 41 | 4.5 | 10 Dec |
| marble | Marble | Permanent maritime domain awareness made easy | Ocean Intelligence | Europe | Pilots | commercial | 33 | Pending | 15 Jan |
| vlinder | Vlinder | Mangrove restoration done right | Ecosystems | Europe | Pilots | financing (provisional) | 21 | Pending | 14 Jan |
| wsense | WSense | Building the Internet of Underwater Things | Ocean Intelligence | Europe | Exited | — | — | — | — |
| unannounced | (not shown by name) | — | — | — | — | — | — | — | — |

- WSense: status `exited`. Fincantieri agreed to take a majority stake, July 2026 (P).
- `unannounced`: status `unannounced`, `public=false`. It is counted in totals only and never named. Its constraint is excluded from the "stuck" counts.
- Only Desolenator has `anchor=true` and `board_seat=true`. The rail's "Board seats" section lists only Desolenator.
- "Rates us" for companies with a seeded ledger (Desolenator) is the mean of their rated commitments in the projection, including session ratings. For the others it is `companies.rating_seed`. The firm average shown on Home is the mean of the nine numeric company ratings, rounded to one decimal: 4.4 at seed.

**Derived checks (unit tests must assert these from seed):**

- Stuck by constraint:
  - Operations and delivery 5 (Flocean, Kelp Blue, Full Circle Biotechnology, SWAY, Hullbot)
  - Commercial traction 4 (Marble, Coral Vita, Vessev, Matter)
  - Financing 2 (Desolenator, Vlinder)
- Over benchmark: 2 (Vessev 97 > 90; Full Circle Biotechnology 118 > 110).
- Active public 11, exit 1, unannounced 1, backed 13.

## 4. Benchmarks and cleared cases (all I)

| Domain | Days | Source note | Rypples cases | Confidence |
|---|---|---|---|---|
| financing | 120 | Outside: first pilot to first financed plant or fleet, comparable climate hardware | 0 | Low |
| commercial | 90 | Outside: pilot to first commercial contract | 2 | Low |
| operations | 110 | Outside: first unit to repeatable delivery | 3 | Low |
| technology | 120 | Outside: pilot to independent performance evidence | 0 | Low |
| regulatory | 75 | Outside: certification lead times by market | 1 | Low |
| people | 70 | Blended: Rypples key hires plus outside time-to-hire | 5 | Medium |
| ai | 45 | Outside: first automated workflow in operations | 0 | Low |
| impact | 60 | Outside: first verified Ocean Impact Navigator report | 3 | Low |

Cleared cases: 14 rows, labelled "Case 1" to "Case 14" in clearance order. Each case gets an anonymous label and is never tied to a named company. Domains are distributed per the "Rypples cases" column above.

Days as a fraction of the domain benchmark should trend downward. Suggested values, in order (domain, days):

| Case | Domain | Days |
|---|---|---|
| 1 | people | 88 |
| 2 | operations | 140 |
| 3 | impact | 74 |
| 4 | commercial | 112 |
| 5 | people | 79 |
| 6 | regulatory | 81 |
| 7 | operations | 121 |
| 8 | impact | 63 |
| 9 | people | 66 |
| 10 | commercial | 84 |
| 11 | operations | 98 |
| 12 | people | 58 |
| 13 | impact | 49 |
| 14 | people | 55 |

**Outside sources:** the notes above are placeholders until sourced (for example, Elemental Impact's research on how climate hardware companies scale). Render the "outside ref" label and a footnote saying so.

## 5. Desolenator

### 5.1 Profile (P)

| Field | Value | Source |
|---|---|---|
| CEO | Adri Pols, CEO since June 2024 | `src_deso_news` |
| System | 40 m³/hour modular system; no membranes or consumables | `src_deso_product` |
| Stated cost | US$1 per m³ | `src_deso_product` |
| Plants | Modules start at 250 m³/day; each plant sits in an SPV Desolenator co-owns and operates; water sold on a monthly bill | `src_republic` |
| Team | About 20 people | `src_deso_about` |
| Certifications | ISO 9001, 14001, 45001 | `src_deso_product` |
| Pilots | DEWA (public-private partnership under the Dubai Future Accelerator, announced 2022); Silal (ADQ), solar desalination for food production, announced 2023 | `src_deso_dubai`, `src_deso_abudhabi` |
| Awards | BlueInvest Award 2026 for Ocean Resilience; XPRIZE Water Scarcity semi-finalist, May 2026 (20 of 674 teams) | `src_deso_news` |
| Precedent | Dutch Fund for Climate and Development approved grant support for a Cambodia seawater facility, Dec 2022 | `src_deso_news` (verify; otherwise mark I) |
| Claims | 24/7 solar-only operation; PV-T panels harvest about 4× the energy of standard PV; low-concentration, non-toxic brine | `src_deso_product` (shown as "company claim") |

### 5.2 Sources

| id | URL | Title |
|---|---|---|
| src_deso_product | https://www.desolenator.com/product | Product page |
| src_deso_about | https://www.desolenator.com/about-us | Team page |
| src_deso_news | https://www.desolenator.com/latest-news | Company news |
| src_deso_dubai | https://www.desolenator.com/projects/dubai | DEWA project |
| src_deso_abudhabi | https://www.desolenator.com/projects/abu-dhabi | Silal project |
| src_republic | https://diogo.republic.com/desolenator | Republic deal note |

`pnpm snapshot:sources` fetches each URL, extracts the readable text, and stores it at `data/sources/<id>.md` with a front-matter block containing `url` and `accessed_at`. Commit the snapshots. F1 reads the snapshots, not the live web. These six snapshots are the Desolenator **source pack** (documents). If a page has changed, review the snapshot by hand before committing.

### 5.3 Confirmed diagnostic (kind `public`, confirmed 15 Oct at Day 0 by the board-level partner, S/I)

| Domain | Score | Finding | Sources |
|---|---|---|---|
| Financing **(binding)** | 2 | Plants are financed through SPVs that Desolenator co-owns and operates. Revenue starts only once a plant is financed and built. | Republic, product |
| Commercial traction | 3 | Two flagship pilots: DEWA and Silal (ADQ). No multi-plant contracts public yet. | DEWA, Silal |
| Operations and delivery | 3 | 40 m³/hour modular system with no membranes or consumables. Running several sites in MENA is still to be proven. | product |
| Technology and reliability | 3 | Company claims 24/7 solar-only operation and PV-T panels harvesting about 4× standard PV. No independent field data is public. | product |
| Regulatory | 4 | ISO 9001, 14001 and 45001 certified. Potable-water approvals are needed market by market. | product |
| People | 3 | New CEO since June 2024 to lead the scale-up. About 20 people. Missing project-finance and MENA field-operations leadership. | news, team |
| Impact integrity | 4 | No chemicals or membranes; low-concentration, non-toxic brine. BlueInvest Award 2026 for Ocean Resilience. | product, news |
| AI adoption | null (evidence gap) | Nothing public on remote monitoring or predictive maintenance. Requested for the next board pack. | — |

- **Binding constraint statement:** "Asset capital for water-as-a-service plants". Detail: "Each plant sits in an SPV that Desolenator co-owns and operates, and sells water on a monthly bill. Nothing earns until the plant is financed and built. The pilots aren't the limit. Plant capital is."
- **Ask, don't tell (questions):**
  1. What does the capital stack for one 250 m³/day plant look like, and who has said yes?
  2. Which pilot buyer, DEWA or Silal, is closest to a multi-plant commitment?
  3. What field data would convince an infrastructure fund the plants perform?

### 5.4 Technical risks to evidence (I)

| Risk | Test | State |
|---|---|---|
| Output holds through Gulf summer heat and dust | 90 days of output and uptime at a live site | No data (amber) |
| Thermal storage carries 24/7 operation | Overnight output logs from the pilot | Company claim |
| Brine discharge stays within permit at scale | Discharge monitoring against permit limits | Partly shown |
| One team can run several remote sites | O&M hours per site across two sites | No data (amber) |

Footnote: "The Field Reliability Review program can close the first two."

### 5.5 Lifecycle (S)

| Stage | Note | Status |
|---|---|---|
| Day 0 | The diligence diagnostic became the plan. Growth Engine allocation agreed in the term sheet. | 15 Oct · done |
| First 100 days | Constraint confirmed. Plant Finance Sprint and Key Hire running. Board rhythm set. | Until 23 Jan · in progress |
| Quarterly loop | Board pack, diagnostic, programs, Playbook. Every quarter, same rhythm. | From Feb 2027 |
| Exit readiness | Strategic buyer and acquirer map kept current from day 0, the WSense play. | Always on |

### 5.6 Allocation and enrolments (I)

Allocation: 3 programs and 400 operator hours a year, source `term_sheet`. Desolenator has used 2 of 3 programs and 120 of 400 hours.

| Program | Operator | Status | Hours |
|---|---|---|---|
| Plant and Fleet Finance Sprint | FE | running, week 4 of 6 | 60 |
| Key Hire: Head of Projects, MENA | PE | running, shortlist | 60 |
| Field Reliability Review | TE | proposed by board-level partner | (40, not counted until running) |

### 5.7 Ledger: "What Rypples owes you" (I)

| id | Commitment | From | Due | Status | Rating |
|---|---|---|---|---|---|
| l3 | Plant unit economics at US$1/m³ | Finance expert | Fri 27 Nov (+4) | in_progress | — |
| l1 | Introductions to 3 infrastructure funds with water mandates | Board-level partner | 15 Dec | in_progress | — |
| l4 | Offtake contract template for public buyers | GTM expert | 19 Dec | not_started | — |
| l6 | Decision on a first-loss position in plant SPV #1 | Rypples investment team | 31 Jan | open | — |
| l2 | Plant-level model review | Finance expert | 18 Nov | delivered | 5 |
| l5 | Seat in Ocean Scalers, Circle 02 | Rypples programs | Oct | delivered | 4 |

Company rating = mean of rated rows (seeded 4.5).

### 5.8 Engine: board pack Q4 (meeting +3)

| key | Name | State | Notes |
|---|---|---|---|
| letter | CEO letter | Needs you (amber) | Outline: where plant capital stands, what changed with DEWA and Silal, the Head of Projects search, and the one decision you want from the board. CTA "Start writing" (F5) |
| fin | Financials and KPIs | Ready · from your finance system | Rows masked `••••`: Cash and runway; Revenue and contracted water volume; Plant capex committed; Headcount. Copy: "Figures are masked in this preview. In Engine they come straight from the source, with the date they were pulled." Never invent Desolenator financials |
| pilots | Pilots and plant pipeline | Needs you · confirm status | DEWA (Pilot · confirm), Silal (Pilot · confirm), Data centres and industry (Pipeline), XPRIZE Water Scarcity (Semi-finalist). CTA "Confirm stages" |
| plan | Plan progress | Ready · from your Engine plan | P1 repeatable plant-finance template: unit economics in progress, fund introductions due 15 Dec. P2 multi-plant offtake: contract template starts this month. P3 Head of Projects, MENA: scorecard agreed, search under way |
| asks | Asks of the board | Drafted · review | 1. Decision on a first-loss position in plant SPV #1. 2. Introductions to infrastructure investors with water mandates, beyond the three in progress. 3. Feedback on the offtake template. CTA "Redraft" (F5) |
| ops | Operations and uptime | Needs you · data missing | "No plant data connected yet." CTA "Add data" (manual entry form: site, uptime %, output m³/day; values are session-scoped and labelled founder-entered) |

### 5.9 Engine: capital (I unless stated)

- **Capital stack** (most junior at the top):
  1. Sponsor equity: Desolenator, as operator (Committed)
  2. First-loss equity: Rypples balance sheet, proposed (Decision 31 Jan)
  3. Asset equity: Infrastructure co-investor (Sourcing)
  4. Senior debt: Against the offtake contract (Needs offtake)
  5. Grants and concessional (Optional)

  Source: Republic deal note (the SPV structure is P; the layers' statuses are I).
- **Instruments** (shortlist toggles; `inf` shortlisted by default):
  - `inf` Infrastructure funds with water mandates: "Asset equity for SPV #1. Board-level partner introductions due 15 December."
  - `ryp` Rypples first-loss position: "Permanent capital taking the junior slice that brings cheaper money in behind it."
  - `blu` EU BlueInvest network: "You won the BlueInvest Award 2026 for Ocean Resilience. Check follow-on access."
  - `dfcd` Dutch Fund for Climate and Development: "Approved grant support for your Cambodia seawater facility in December 2022. A precedent."
  - `eca` Export credit for MENA plants: "Dutch-built equipment going to the Gulf may qualify. To verify."
- **Pilot to contract** (stages: Pilot, Terms, Contract, Multi-site):
  - DEWA: stage 1
  - Silal (ADQ): stage 1
  - Data centres and industry: stage 0, "Target segment on desolenator.com · pipeline to build"
  - XPRIZE Water Scarcity: stage 1, "A milestone, not a buyer"

### 5.10 Desolenator decision for Jerome (S/I)

"Take a first-loss position in plant SPV #1?" Line: "Infrastructure funds want a junior tranche before they commit. Raised by the board-level partner." Actions: "Discuss at the board" (records `decision.resolved` with outcome `board_agenda`, and adds the item to the board pack's Asks if not present) and "Open the model" (opens a modal with the capital stack. The model figures are I, labelled).

## 6. Growth Engine and operating partners (I)

### Programs

| slug | Name | Domain | Weeks | Hours | Outcome | Delivered by | Running | Done | Rating |
|---|---|---|---|---|---|---|---|---|---|
| finance-sprint | Plant and Fleet Finance Sprint | financing | 6 | 60 | A signed term sheet for the first asset SPV | Finance expert | 3 | 2 | 4.8 |
| pilot-to-contract | Pilot to Contract | commercial | 8 | 70 | Conversion terms in every live pilot | GTM expert | 2 | 3 | 4.3 |
| field-reliability | Field Reliability Review | technology | 4 | 40 | An evidence pack buyers and lenders accept | Independent technical expert | 1 | 1 | 4.6 |
| key-hire | Key Hire | people | 10 | 60 | A signed hire against an agreed scorecard | People expert and bench | 3 | 4 | 4.4 |
| certification | Certification Path | regulatory | 4 | 30 | An approvals plan with dates and owners | Regulatory expert | 1 | 2 | 4.5 |
| partner-map | Strategic Partner Map | commercial | 3 | 25 | Three strategics engaged as buyer, investor or acquirer | GTM expert | 1 | 1 | 4.7 |
| ai-ops | AI in Operations | ai | 4 | 40 | One operating workflow automated | Rypples platform team | 1 | 0 | — |
| impact-evidence | Impact Evidence | impact | 4 | 30 | Ocean Impact Navigator KPIs reported | Impact expert | 0 | 3 | 4.2 |

Allocation copy: "Each Anchor company gets three programs and 400 operator hours a year, paid for from Rypples' balance sheet. The founder chooses which programs. Delivery shows up in their ledger, and they rate it."

### Operators (role and monogram only; types in `partner_types.json`)

| id | Initials | Role | Focus | Covers | Stage | Hours q / committed | Open | Delivered | Rating |
|---|---|---|---|---|---|---|---|---|---|
| bp-water | BP | Board-level partner (external) | Water and infrastructure | Desolenator | Active | — | 2 | 3 | 4.6 |
| bp-maritime | BP | Board-level partner (candidate, `for_deal_id: tern`) | Maritime | — | In conversation | — | — | — | — |
| bp-intelligence | BP | Board-level partner (candidate, for Project Kelvin) | Ocean Intelligence | — | Sourcing | — | — | — | — |
| fe | FE | Finance expert | Project finance, SPVs | Desolenator, Vlinder, Kelp Blue | Active | 300 / 270 | 3 | 4 | 4.8 |
| ge | GE | Go-To-Market expert | Utilities and public buyers | Desolenator, Coral Vita, Matter, Hullbot | Active | 240 / 168 | 3 | 2 | 4.2 |
| pe | PE | People expert | Executive search | Desolenator, Vessev, Full Circle Biotechnology | Active | 240 / 180 | 2 | 3 | 4.4 |
| ie | IE | Impact expert | Ocean Impact Navigator | Coral Vita, Vlinder, SWAY | Active | 180 / 150 | 1 | 3 | 4.2 |
| te | TE | Independent technical expert | Field performance | Desolenator (proposed), Kelp Blue | Active | 160 / 76 | 1 | 1 | 4.6 |

Board-level partners sit outside the hours pool. Active experts and specialists derive to 844 of 1,120 hours (75%). The tightest operator is the Finance expert (90%), with the note "3 sprints running. Add one before taking a fourth."

### Due this week (missions)

| Mission | Who | Due |
|---|---|---|
| Plant unit economics at US$1/m³ | FE · Desolenator | +4 |
| Head of Projects, MENA: scorecard | PE · Desolenator | +4 |
| Fleet service pricing review | GE · Hullbot | +3 |
| US operations hire shortlist | PE · Vessev | +4 |

### Partners at earlier stages (operators with `stage` set; `partner_recruiting.json` is removed)

| id | Role | Stage | Note |
|---|---|---|---|
| fe-2 | Finance expert, second hire | In conversation | 3 candidates from the bench. Needed before a fourth finance sprint starts. |
| bp-maritime | Board-level partner, Maritime | In conversation | Lined up for Project Tern. |
| bp-intelligence | Board-level partner, Ocean Intelligence | Sourcing | For Project Kelvin if Rypples leads. |
| re | Regulatory expert | Onboarding | Playbook briefing done. First mission: Certification Path for Kelp Blue. |
| lip | Legal and IP specialist | Sourcing | |
| sci | Marine science adviser | In conversation | |

Every partner has a 4-step onboarding checklist: Playbook briefing; context pack assembled by Captain; first mission or board agreed with the founder; first founder rating.

### Talent (shown on each company's page and in the People expert's record)

Open roles:

| Role | Company | Why | State |
|---|---|---|---|
| Head of Projects, MENA | Desolenator | Binding constraint: plant delivery after financing | 4 on shortlist |
| US operations lead | Vessev | First US customer named | Sourcing |
| Plant manager | Full Circle Biotechnology | New production plant | Sourcing |
| VP Sales, fleets | Hullbot | Repeatable sales stage | Brief agreed |

- **Bench (46):** Project and infrastructure finance 9 · Operations in MENA and APAC 11 · Series production and manufacturing 14 · Utility and public-sector sales 12.
- **CEO development** (now in the Ocean Scalers tab): "Every Anchor CEO gets a day-100 360, a matched coach and an Ocean Scalers circle." Adri Pols: 360 booked for 20 Jan · coach matched · Circle 02.

### Growth Readiness (`readiness_plans.json`, 9 rows)

Five modules: 01 Buyer map, 02 Price and unit economics, 03 Pilot-to-contract terms (delivered through Pilot to Contract), 04 First sales hire, 05 Board-ready metrics (domain financing). Seed: Desolenator 02 in progress inside the Finance Sprint; Vessev, Matter, Coral Vita and Marble have recommended or in-progress modules.

### Ocean Scalers: Circle 02 · First commercial deployments

- Session 3 of 4 · Thu 3 Dec, 16:00 CET.
- Members: Desolenator, Coral Vita, Vessev, Full Circle Biotechnology, SWAY, Matter.
- Composition rule shown: "Same scale stage. No direct competitors. Four of five verticals. Sessions rotate across time zones."
- Excluded: Flocean (same market as Desolenator: freshwater), Kelp Blue (earlier stage, overlaps SWAY on seaweed), WSense (exited).

Commitments since session 2:

| Company | Commitment | Status |
|---|---|---|
| Desolenator | Share a one-page plant capital stack with the circle | Done |
| Coral Vita | Bring one public-buyer contract for review | Open |
| Vessev | Close the first operations hire outside New Zealand | At risk |
| SWAY | Test pricing with two manufacturers | Done |
| Matter | Name the three buyers who decide fastest | Open |

### Growth Readiness (domains normalised)

| Module | Focus | Outcome | Domain |
|---|---|---|---|
| 01 Buyer map | Buyers | Who signs, who pays, who blocks | commercial |
| 02 Price and unit economics | Pricing | A price that still works at ten times the volume | financing |
| 03 Pilot-to-contract terms | Contracts | Conversion written into every pilot | commercial |
| 04 First sales hire | Hiring | Scorecard, search and onboarding plan | people |
| 05 Board-ready metrics | Reporting | The KPIs Rypples OS reads each quarter | financing |

The focus is the card's label; the domain is the diagnostic score the module lifts, so two modules can share one.

### Promises (shown in Engine)

| Promise | Text |
|---|---|
| Two working days | The longest you wait for a reply from your board-level partner. |
| A brief with every intro | Nobody we introduce walks in without context. |
| You rate everything | Your ratings go to Jerome, unfiltered. |

## 7. Playbook

### Lesson `wsense-strategic` (approved state is session-driven; seed status `proposed`)

- **Title:** "Bring the strategic onto the cap table before you need them as a buyer, or as an acquirer."
- **Domain:** commercial. **Learned in:** WSense.
- **Timeline (P):**

  | Date | Event | Source |
  |---|---|---|
  | Dec 2023 | Memorandum of understanding with Fincantieri on strategic collaboration | `src_wsense_round` |
  | Apr 2025 | Fincantieri invests in the €7.2M pre-Series B, alongside Rypples | `src_fincantieri_2025` |
  | Feb 2026 | Technology and commercial co-development agreement | `src_wsense_acq` (verify; otherwise I) |
  | Jul 2026 | Fincantieri agrees to take a majority stake, part of a roughly €600m package of four underwater deals | `src_wsense_acq` |

- **The play:**
  1. Name the three strategics most likely to be both your largest customer and your eventual acquirer.
  2. Offer one a small allocation in the next round, tied to a commercial agreement.
  3. Move the pilot into co-development before anyone negotiates exclusivity.
- **Sources:**

  | id | URL |
  |---|---|
  | `src_wsense_round` | https://seedtable.com/companies/wsense/funding-rounds/series-b-2025-04 |
  | `src_fincantieri_2025` | https://www.fincantieri.com/en/media/press-releases/2025/fincantieri-invests-in-wsense-to-develop-innovative-solutions-for-the-naval-and-submarine-sector |
  | `src_wsense_acq` | https://en.portnews.ru/news/393775/ |

  Verify each date against its source when snapshotting. Correct the date or reclassify it if a source disagrees.
- **Matches** (seeded as F4 precomputed output):

  | Company | Reason |
  |---|---|
  | Desolenator | Strategic partners in both flagship pilots, DEWA and Silal (ADQ). Neither appears on the cap table in public sources. |
  | Flocean | Xylem joined the Series A as a strategic investor in December 2025. The next step is co-development terms. (Needs a source; otherwise rewrite as I.) |
  | Marble | Security and defence buyers. Check the cap table before sending. |

### WSense replay (`replay_steps`)

Each step shows the real event (P) and the platform's reading (I, labelled "How the platform would have read it"):

| Date | Platform reading |
|---|---|
| Dec 2023 | Strategic Partner Map: Fincantieri flagged as likely largest customer and likely acquirer. Lesson candidate opened. |
| Apr 2025 | Cap table: strategic now a shareholder. Commercial traction risk falls. Constraint moves to Operations and delivery. |
| Feb 2026 | Strategic path: co-development signed before exclusivity. Exit-readiness pack started. |
| Jul 2026 | Exit. Lesson drafted from four sources and proposed for approval. |

### Intake ("Coming in from the last week")

| Session | Who | Outcome | CTA |
|---|---|---|---|
| Desolenator board prep call | Board-level partner · −4 (Thu 19 Nov) | 1 lesson proposed: price the first plant on total cost of ownership, not capex. 2 actions added to missions. | Review |
| Finance expert session with Vlinder | Finance expert · −5 (Wed 18 Nov) | No new lesson. 3 actions added to missions. | Open |
| Ocean Scalers, Circle 02, session 2 | Facilitator · −6 (Tue 17 Nov) | 1 lesson proposed from themes only. Circle notes stay confidential. | Review |

These come from the demo meeting-notes adapter (`docs/08-mcp-and-integrations.md` §4).

### Library (domains normalised)

| Lesson | Domain | Learned in | Sent | Helped |
|---|---|---|---|---|
| Write conversion terms into every pilot | commercial | Growth Readiness, module 03 | 4 | 3 of 4 |
| Price the first plant on total cost of ownership, not capex | financing | Finance expert session | 2 | 2 of 2 |
| Hire operations leadership in-market before the second site | people | Ocean Scalers, Circle 01 | 3 | 1 of 3 |

## 8. Pipeline (all fictional, I)

| Stage | Deals |
|---|---|
| Sourced | Project Ebb (Ocean Health · Europe · "Flagged: Series A closed, first plant"); Project Spinnaker (Ecosystems · Americas · "Flagged: grant win, scaling team"). Plus `sourcing_signals` ×12: "Flagged this week (12)" expands to a list |
| First meeting | Project Halyard (Blue Foods · APAC · Meeting Wed 2 Dec); Project Bowline (Maritime · Europe · Meeting Thu 3 Dec) |
| Diligence | Project Kelvin (Ocean Intelligence · Europe · Diagnostic running); Project Mooring (Ecosystems · APAC · Data room received) |
| Investment committee | Project Tern (Maritime · Europe · IC Fri 27 Nov) |
| Led | (empty; "Anchor rounds led this quarter") |

Header stats: "13 backed in 18 months" and "10 a year to reach 100".

**Project Tern:**

- **What:** "Electric workboats for offshore wind service. Two paying fleet customers, Series A open."
- **Proposed constraint:** Operations and delivery: "a second production line". Why: "Order book is ahead of build capacity. Lead time is the reason the third customer hasn't signed."
- **Evidence:** 41 items (diligence JSON with about 12 representative evidence items and 8 domain scores, all I, used by F7).
- **Day-one drafts:**
  1. Fund and staff the second line before the third fleet order.
  2. Write conversion terms into both pilot extensions.
  3. Hire a COO with series-production experience.
- **Partner:** Board-level candidate lined up: Maritime (`bp-maritime`, in conversation; moves to onboarding on day one).
- **Lesson:** Related Playbook entry: hire operations leadership in-market before the second site.
- **Founder:** "CEO, Project Tern" (PT).

Kelvin, Halyard, Ebb and Spinnaker keep the texts from the mockup (`what`, `constraint`, `why`, `partner_note`, `lesson_note`, `cta_label`).

## 9. Home (S1)

Decisions ("Needs your decision"):

1. Desolenator: "Take a first-loss position in plant SPV #1?" Line: "It would bring in asset equity from an infrastructure co-investor. Raised by the board-level partner." Action: "Before Thursday →" (company page).
2. Playbook: "Send the WSense lesson to Desolenator, Flocean and Marble?" Line: "Drawn from WSense's path to Fincantieri: strategic investor, then partner, then acquirer." Action: "Review lesson →".
3. Pipeline: "Take Project Tern to investment committee?" Line: "Diligence diagnostic is ready. Proposed binding constraint: Operations and delivery." Action: "Open diligence →".

Agenda ("This week"):

| Offset | Item | Note |
|---|---|---|
| +1 | Ocean Scalers, Circle 02 prep | Facilitator brief ready |
| +3 | Desolenator board | Pre-read and diagnostic ready |
| +4 | Investment committee: Project Tern | Diligence diagnostic attached |
| +4 | 4 operating partner missions due | 2 for Desolenator |

## 10. Investor relations

- **Impact (Ocean Impact Navigator; KPI wording I, status I):**

  | Company | KPI | Status |
  |---|---|---|
  | Desolenator | Freshwater produced without chemicals or membranes | In progress |
  | Flocean | Freshwater produced without coastal brine | Reported |
  | Coral Vita | Reef area restored | Reported |
  | Vlinder | Mangrove area restored | Reported |
  | Kelp Blue | Giant kelp farmed offshore | Reported |
  | Full Circle Biotechnology | Wild fish replaced in feed | Reported |
  | SWAY | Fossil plastic displaced | Reported |
  | Hullbot | Fuel and emissions avoided by clean hulls | Reported |
  | Vessev | Emissions avoided against diesel ferries | In progress |
  | Matter | Microplastics captured | Not yet |
  | Marble | Ocean area under persistent monitoring | Not yet |

  "About the framework" links to https://katapult.vc/ocean/un-ocean-conference-lisbon-an-ocean-emergency-and-the-rising-wave-of-measurable-impact (`src_oin`).
- **Strategic paths:**

  | Company | Now | Likely | Program |
  |---|---|---|---|
  | WSense | Fincantieri: strategic investor, then partner, then majority owner (July 2026) (P) | Done | Exited |
  | Desolenator | DEWA and Silal (ADQ) as pilot partners. Neither is a shareholder (P from public sources) | Water utilities, desalination contractors, industrial water users (I) | Proposed |
  | Flocean | Xylem joined the Series A as a strategic investor (Dec 2025) (needs a source) | Water technology groups, offshore energy contractors | Running |
  | Hullbot | Not mapped yet | Shipping lines, hull coating and marine services groups | Not started |
  | Vessev | First US customer named (Aug 2026) (needs a source) | Ferry operators, shipbuilders | Not started |
  | Marble | Not mapped yet | Defence and security primes, port operators | Not started |

- **Shareholder update draft (Q4 2026):** precomputed F6 output built from approved records. References to: backed count, WSense exit and the €600m package, Desolenator anchor and day N, programs running (derived from enrolments: 12 at seed), firm rating 4.4, lessons sent, impact 7 of 11 reporting.

## 11. Captain overnight (precomputed)

| What | State | Route |
|---|---|---|
| Drafted the pre-read for Desolenator's board | Ready | company |
| Turned 3 meeting notes into 2 proposed lessons | Review | playbook |
| Flagged 12 companies entering the scale gap | In Pipeline | pipeline |
| Drafted the Q4 shareholder update | Review | reporting |
| Drafted Q4 KPI requests to 2 founders | Needs approval | reporting |

Suggested prompts (chips):

- Which companies are behind their benchmark, and what are we doing about it?
- What should I ask at Desolenator's board on Thursday?
- Who in the portfolio should hear the WSense lesson next?
- Where is operating partner capacity tight this quarter?

## 12. Integrations (demo adapters, labelled "Demo connection")

- **Drive:** board packs and data-room index for Desolenator and Tern (file names only).
- **CRM:** pipeline contacts as codenames.
- **Meeting notes:** the three intake sessions in §7.
- **Finance system:** masked Desolenator KPIs (shape only, `••••`).
