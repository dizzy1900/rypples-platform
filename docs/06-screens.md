# 06 · Screens

**Format for each screen:** route · purpose · layout · data (projection) · controls (every control and its effect) · states · acceptance.

**Common to every OS and Engine screen:**

- The shell from `docs/02-design-system.md` §3.
- A footer line with the scenario note and the **Reset demo** link.
- Ask Captain in the top bar.
- Breadcrumbs that are real links.
- Data comes from projections only. Every illustrative value is wrapped in `<Illustrative>`. Every public fact shown in a finding has a `SourceChip`.

**States every screen implements:**

- Loading: route-level `loading.tsx` with a calm layout skeleton: line placeholders at white 6%, no shimmer.
- Error: `error.tsx` with "Something went wrong loading this page" and a "Try again" button.
- Empty: written per section below.

---

## S0 Welcome · `/`

**Purpose:** explain the platform in ten seconds and offer two doors.

**Layout** (rypples.earth style, stacked 80px panels, faint arcs):

1. **Hero.** No eyebrow; the Rypples logo sits in the header above. H1 "The system behind the Growth Engine". Lede: "One platform for Rypples and the companies it anchors. Find the one constraint that matters, deliver the help that clears it, and learn from every company so the next one scales faster."
2. **Two door tiles** (outline tiles, lime icons):
   - **Rypples OS:** "For the Rypples team. Decisions, portfolio, the Playbook, operating partners, founder programs, pipeline and investor relations." Link: "Enter as Jerome Ternynck →" (`/os`).
   - **Rypples Engine:** "For founders. A board pack drafted for you, your plan and programs, and a ledger of what Rypples owes you." Link: "Enter as Adri Pols, Desolenator →" (`/engine/desolenator`).
3. **"One rhythm, every company."** Four lifecycle steps (Day 0, First 100 days, Every quarter, Strategic path) with the texts from the mockup.
4. **"Adding value, not taking over."** The six principles from `docs/01-product.md` §3.
5. **Three quiet text links:** "Try it on any ocean company" (`/os/diagnostic/new`), "Connect Rypples to your Claude" (`/connect`), "What's real and what's illustrative" (opens the about modal).
6. Scenario disclaimer line.

**Primary button:** none; the two doors are the actions.

**Acceptance:** both doors work. The about modal opens and closes with Esc. The page renders at 390px with the doors stacked.

---

## S1 Jerome's home · `/os`

**Purpose:** what needs Jerome now, and how the firm is doing against its plan.

**Header:**

- Eyebrow "Your brief".
- H1 "Good morning, Jerome." The greeting uses the scenario clock in Europe/Paris: morning before 12:00, afternoon until 18:00, evening after.
- Lede (derived): "Three things need you this week. Desolenator is on day {N} of its first 100 days with Rypples as anchor, its board meets on Thursday, and the lesson from WSense's exit is ready to send to three companies." Built from decisions, the scenario and lesson state. When a decision is resolved, the count word updates ("Two things…").
- Line: "Captain prepared this brief overnight from {n} records. Open Captain →" (opens the drawer).

**Sections:**

1. **Needs your decision** (`DecisionRow` ×3, `docs/05-seed-data.md` §9). Count pill "3 open". Each action is a link to the route. Resolving happens on the target screen, and the row disappears when its decision event exists.
   - Empty: "Nothing waiting for you. Captain will add decisions here as they come up."
2. **This week:** agenda list. Each row links to its route.
3. **Where the portfolio is stuck:** three horizontal bars by constraint (derived counts, company names listed under each). The financing bar is lime because it holds the board-seat company. "Open portfolio →".
4. **The plan so far:** a slim summary strip, last on the page because it changes slowly. Compact `DotGrid` (20×5, 6px dots) with "13 of 100 ocean-positive companies", an inline legend (11 active, 1 not yet announced, 1 exit: WSense to Fincantieri, July 2026) and "Founders' rating of Rypples 4.4 / 5", derived and illustrative. After F7 in the session: 14, with Tern's dot added as active.

**Primary button:** none on Home. All actions are links.

**Acceptance:** counts match the derived checks in `docs/05-seed-data.md` §3. Resolving the Desolenator decision on S4 removes it here and decrements the rail count.

---

## S2 Portfolio · `/os/portfolio`

**Header:** eyebrow "Portfolio". H1 "Thirteen backed. One constraint each." The number word is derived.

**Stats row:** Active 11 · Exit 1 · Over benchmark 2 · Founder rating 4.4 (all derived).

**Controls:**

- **Vertical tabs:** All, Ocean Health, Ecosystems, Blue Foods, Maritime, Ocean Intelligence. Synced to `?vertical=`. Non-matching rows dim to 25% opacity (they are not removed), and the counts in the stats row recalculate for the filter.
- **View toggle:** Table / Constraint map (`?view=`).

**Table view:** columns Company (name and tagline), Vertical, Region, Stage, Binding constraint, Days open (`DaysBar` plus "of {bench} days · outside ref", where "outside ref" links to S9 Acceleration), Rates us, Next board.

- The Desolenator row is highlighted with a lime 6% fill.
- Rows link to `/os/companies/[slug]`.
- WSense appears as an exited row at the bottom: "Majority stake to Fincantieri, July 2026. Lessons in the Playbook." It links to the Playbook lesson.

**Constraint map view:** the eight domains as rows. Companies appear as chips in the row of their constraint. The Desolenator chip is lime. Empty domains read "No company held here today".

**Footnote:** "The 12 companies on the public portfolio. The 13th is not yet announced. White tick marks the benchmark for that constraint. Every benchmark is an outside reference for now. Each switches to Rypples' own data after eight cleared cases (see Investor relations, Acceleration). Dotted figures are illustrative."

**Phone width:** rows become stacked items (name, then constraint and days bar, then a meta line).

**Acceptance:** filter, toggle and row links work. Values are derived from seed. URL state survives a reload.

---

## S4 Company record · `/os/companies/[slug]`

### S4-full (Desolenator, or any company with `anchor=true` in the session, e.g. Tern after F7)

**Header:**

- Pills: vertical, region. Desolenator also shows "Board-level partner · water and infrastructure".
- H1: company name. Tagline in lime.
- Meta: "CEO Adri Pols · 40 m³/hour modular system · Stated cost US$1 per m³" (P, with sources on hover).
- Actions: "See Adri's view in Engine" (outline → `/engine/desolenator`). **Primary button: "Run diagnostic"** (→ S5a).

**Lifecycle tile:**

- Title: "Day {N} of the first 100".
- Scenario line: "Scenario: Rypples led Desolenator's next round on 15 Oct 2026 and took a board seat."
- The four stages from seed, with the current stage highlighted.
- Link: "How Rypples works with founders →" (S14, founder view in a new tab).

**Before Thursday's board** (pre-read, generated overnight; precomputed F1 result plus seeded content):

- Meta: "Thu 26 Nov · pre-read refreshed today".
- Binding constraint panel: domain label, statement, detail, source chips.
- "Ask, don't tell": the three questions. Each question has a copy icon, and "Send to Captain" opens the drawer with "Help me prepare this question for the board: …".
- **Decision waiting for you:** the first-loss SPV #1 question. Buttons "Discuss at the board" and "Open the model" (`docs/05-seed-data.md` §5.10).

**Tabs** (`?tab=`): Diagnostic · Technical risks · Market evidence · Programs · Ledger · Board history.

- **Diagnostic:** eight domains. Each row has the domain label, BINDING flag, `ScoreBar`, finding and source chips. Header meta: "Confirmed 15 Oct at Day 0 by the board-level partner". "Evidence gap" for AI adoption, with the note "Requested for the next board pack".
- **Technical risks:** a table of the four hypotheses with test and state, plus the footnote. Button "Propose Field Reliability Review" changes the TE enrolment from proposed to requested (event) and adds a ledger commitment in Engine.
- **Market evidence (signature moment 3):** see §S4b.
- **Programs:**
  - Growth Engine allocation: "From the term sheet". Big numbers "2 of 3 programs this year" and "120 of 400 operator hours", both derived.
  - Enrolment rows: name, operator, state.
  - Key hires: open roles for this company, with state (a "Key hire" row for non-Anchor companies).
  - Link: "View the Growth Engine schedule →" (S4c).
- **Ledger:** the same ledger the founder sees (read-only here). Header "How Adri rates Rypples 4.5 / 5 across {n} delivered commitments". Link "See the ledger Adri sees →" goes to Engine.
- **Board history:** last meeting (seeded: Day 0 board, 15 Oct, "Diligence diagnostic confirmed; plan adopted") and the next meeting. Each entry links to its pack. The Q4 pack state comes from Engine: "Drafting · 3 sections need Adri" until shared, then "Shared · diagnostic sent to Adri".

### S4-standard (other portfolio companies)

- Header: pills, name, tagline, website link (P).
- Constraint panel: seeded domain with days open versus benchmark (I).
- **"What public sources show"**: the precomputed F2 diagnostic for that company (reviewed fixture), with eight domain rows and source chips. Meta "From public sources · run {date} · proposed". Button "Run again live" re-runs F2 (live or cached by budget).
- Rating, next board, strategic path row, impact KPI row.
- No lifecycle tile: the "Board seat" and "Anchor" content is shown only for anchor companies.

**Acceptance:** every tab works and is linkable. Source chips open the correct URLs. Resolving the decision records an event, and S1 updates. S4-standard renders for all 11 other portfolio companies. WSense renders as exited, with the replay link.

### S4b Market evidence (tab on Desolenator; also embedded in S13)

**Purpose:** where the next plants should go, from physical data a lender would accept as a starting point.

**Layout:**

- Left: `MarketMap` (SVG choropleth over candidate countries; colour = composite score on a lime ramp; others white 6%). Pilot sites (Dubai, Abu Dhabi) are shown as pins, and the Cambodia precedent as a ring.
- Right: ranked list of the top 10 markets. Each row has the rank, country, a composite score bar, and the two indicator values with units ("Water stress: Extremely high (>80%)", "Solar: 6.1 kWh/m²/day") plus flags ("Pilot here", "Rypples board-level partner coverage").
- **Weight sliders:** Water stress (default 50), Solar resource (30), Existing presence (20). They must sum to 100 and auto-normalise. The ranking re-sorts with a 200ms layout animation.
- **"Why these three"**: a short templated explanation of the top three from their indicator values (deterministic text, no AI). Plus "Ask Captain about these markets" (prefilled).
- **Caveat** (always visible): "Shows where demand for desalinated water is physically strongest and solar resource is best. It does not show tariffs, market size or offtaker credit, which the Strategic Partner Map program covers."
- **Attribution:** "Water stress: WRI Aqueduct 4.0 (CC BY 4.0), accessed {date}. Solar: NASA POWER climatology. Boundaries: Natural Earth."

Data and method: `docs/09-geodata.md`.

**Acceptance:** sliders re-rank deterministically (unit test on `lib/geo`). Hover and focus on a country shows its values. Keyboard users can move through the list. Renders at phone width with the map above the list.

### S4c Growth Engine schedule · `/os/companies/[slug]/schedule` and `/engine/[slug]/schedule` (signature moment 6)

**Purpose:** show the service as a contractual product. This is the one-page annex that would sit in an Anchor term sheet.

**Render:** a `Paper` document generated deterministically from data (no AI). Sections:

1. **Parties and purpose:** company, Rypples, round close date, board seat. "Rypples leads with one board seat and a minority stake. Everything else is help the founder chooses."
2. **Allocation:** programs per year and operator hours per year, funded by Rypples. Board-level partner named by role and focus.
3. **Programs available:** the catalogue, with each program's outcome and length.
4. **Rypples' promises:** the three promises.
5. **Founder rights:** choose programs; decline any program or introduction; disagree with the binding constraint and have it reviewed; rate every delivery (ratings go to the CEO unfiltered); own the plan.
6. **What Rypples will not do:** take operational control; hire or fire on the founder's behalf; require exclusivity on introductions; share Rypples OS records with co-investors.
7. **How it's measured:** days to clear the binding constraint against benchmark; delivery against allocation; founder ratings. Reviewed at each quarterly board.
8. **Data:** the founder chooses what co-investors see from Engine.

Footer: "Illustrative schedule for the prototype. Not legal terms."

**Controls:** "Print or save as PDF" (`window.print()` with print CSS, A4, paper colours). "Back to company".

For Tern (after F7) the schedule shows Tern's allocation and its chosen programs.

**Acceptance:** prints cleanly on one or two A4 pages. Values match the allocation data.

---

## S5a Diagnostic, portfolio pack · `/os/companies/[slug]/diagnostic` (moment 8)

**Purpose:** board pack in, diagnostic out, every score cited.

**Header:** eyebrow "Diagnostic". H1 "Desolenator, read end to end". Lede: "The agent reads the pack, pulls out evidence and scores eight diagnostic domains, with a citation for every score. Here the pack is Desolenator's public record. In use, it's the quarterly board pack."

**Layout:**

- Left column, **Source pack:** the six documents (name, kind, link to the URL, "snapshot {date}"). Below it the **Run** panel with `ProgressSteps`:
  1. Reading the pack
  2. Extracting evidence
  3. Mapping to the 8 domains
  4. Scoring with citations
  5. Checking the Playbook
  6. Proposing the binding constraint
- Right column, **Scores:**
  - Empty state: "Nothing scored yet. Press Run. Scores appear as the agent finds evidence for each domain."
  - Domains stream in as they are scored. Each shows a finding and "From {source}", where clicking the source opens a popover with the `cited_text` and the location in the snapshot.
- **Proposed binding constraint panel** after completion: domain and statement, "Counts once the board-level partner or you confirm it." Buttons "Adjust" (choose another domain from a menu; reason required) and **primary "Confirm"** (records `constraint.confirmed`; the panel shows "Confirmed by Jerome Ternynck").

**Controls:** "Run diagnostic" (→ F1 stream; label becomes "Running…" then "Run again"), "Reset". In cached mode the run replays the precomputed output at a realistic pace, and the panel shows a quiet "Replaying a recent run" note.

**Acceptance:** a live run completes in under 60 seconds. Every score has at least one evidence item resolving to a snapshot location. Scores of null show "Evidence gap". Confirm and Adjust write events.

---

## S5b Run on any ocean company · `/os/diagnostic/new` → `/os/diagnostic/runs/[runId]` (signature moment 1)

**Purpose:** prove it's real: Jerome chooses the company.

**Input page:**

- Eyebrow "Diagnostic". H1 "Try it on any ocean company". Lede: "Name a company or paste its website. Captain reads what's public, scores the eight domains with a source for every score, and proposes where Rypples would help first. It says so when the public record is too thin."
- A single input with placeholder "Company name or website". **Primary button "Run diagnostic"**.
- Suggestions below the input: "Recently run" (the shared cache, up to 6 names) and three example chips of real ocean companies from the portfolio.
- Budget states:
  - Live: no note.
  - Cached mode: "Live runs are paused for today. You can open any recent run." The input is disabled and recent runs stay clickable.

**Run page** (streams, then persists; the URL is shareable):

1. **Identity strip:** name, website, inferred vertical, "ocean economy: yes" with a one-line reason.
2. **Progress:** Checking it's an ocean company → Searching public sources ({k} found, listed live with domain names) → Reading → Extracting evidence ({n} items) → Scoring → Matching programs and lessons.
3. **Scores:** the eight domain rows as in S5a. Confidence is shown per domain (low, medium or high as text). Evidence popovers show `cited_text` and URL.
4. **Proposed binding constraint** with rationale and evidence links.
5. **Where Rypples would help first:** up to two catalogue programs with a reason each, and matching Playbook lessons.
6. **Ask, don't tell:** three questions for the founder.
7. **Footer:**
   - "Proposed from {k} public sources on {date}. Not reviewed by a person."
   - Buttons: "Run again" (bypasses the cache, subject to budget), "Copy link", "Add to pipeline as a codename" (creates a session-scoped Sourced deal "Project {random sailing term}" with the run attached, and links to S8).

**Outcomes:**

- **Declined (not ocean):** a calm panel: "{Name} doesn't look like an ocean company: {reason}. The diagnostic is tuned to the ocean economy." The input is shown again.
- **Insufficient evidence:** shows what was found, marks the gaps, and says "The public record is too thin to propose a binding constraint." No constraint is invented.
- **Ambiguous name:** shows up to three candidate companies (name and domain) to choose from before research starts.
- **Error or timeout:** "Captain couldn't finish this run. Nothing was saved." Button "Try again".

**Acceptance:** see `docs/07-ai.md` F2 and `docs/11-testing-and-evals.md` §4. Each of the five outcomes is reachable and covered by end-to-end tests with mocked streams.

---

## S6 Playbook · `/os/playbook` (moments 4 and 7)

**Header:** eyebrow "Playbook". H1 "What WSense taught us". Lede: "Rypples' first exit, written down so the next three companies don't have to learn it the hard way."

1. **Coming in from the last week** (intake):
   - Meta: "Captain reads board meetings, partner sessions and founder circles from your meeting notes, and proposes lessons. A person approves every one." Count "3 sessions · 2 lessons proposed".
   - Rows: session, who and when, outcome.
   - "Review" opens a side panel with the proposed lesson (title, domain, the session it came from, and for circles "From themes only. Circle notes stay confidential.") and buttons Approve / Reject (events).
   - "Open" shows the actions added to missions.
2. **The lesson:**
   - Status line: "Drafted from 4 public sources · waiting for your approval" or "Approved · in the Playbook".
   - Title. **WSense timeline** with four dated events and source chips.
   - "The play": three numbered steps.
   - Buttons: "Edit" (inline edit of title and play; saves a new lesson version with an event) and **primary "Approve lesson"**.
3. **Replay WSense:** a horizontal scrubber over the four dates (keyboard arrows step through them). For each step, two columns: "What happened" (P, sourced) and "How the platform would have read it" (I, labelled). "Play" auto-advances every 2.5 seconds, and "Pause" stops it. Reduced motion: no auto-advance.
4. **Who it travels to:** "3 of 11 matched".
   - Rows: company, reason, button. The button reads "Approve first" (disabled) until the lesson is approved, then "Send to founder", then "Sent".
   - Sending records `lesson.sent` and triggers the **ripple** (`docs/02-design-system.md` §9). The recipient's Engine home then shows the lesson.
   - "Re-run matching" runs F4 live and refreshes the reasons. It replaces matches only after a person presses "Use these matches".
5. **More from the Playbook:** the library table. The "Helped" column is illustrative.

**Acceptance:**

- You cannot send before approval.
- Each send is reflected in Engine for Desolenator.
- The ripple runs exactly once per send, never on page load, and the reduced-motion path works.
- The replay steps through all four dates.

---

## S7 Operating partners · `/os/operating-partners`

**Header:** eyebrow "Operating partners". Lede: the people who deliver Rypples' help to founders, from sourcing to active. `/os/growth-engine` is removed: `?tab=scalers` and `?tab=readiness` redirect to S7b, everything else here. There is no program catalogue page; partner-delivered programs show in each partner's record and in Engine "How Rypples works".

- **"Find and onboard" funnel strip** above the table: Sourcing, In conversation, Onboarding, Active.
- **CRM table** of every partner at every stage, filtered by type group (Board-level, Expert, Specialist) and by stage. Columns: Partner, Type, What they do, Stage, Tools, Companies, Capacity, Rating. Capacity is a derived load bar for active experts and specialists. Board-level partners are external, sit outside the hours pool, and exist only where Rypples holds a board seat (today Desolenator, `bp-water`). Firm capacity "844 of 1,120 hours (75%)" counts active experts and specialists only; the Finance expert is tightest (90%).
- **Record sheet** (`?partner=<id>`): what they do; the 4-step onboarding checklist (Playbook briefing; context pack assembled by Captain; first mission or board agreed with the founder; first founder rating); companies; tools; what they deliver (programs with founder ratings, Growth Readiness modules); open work. The People expert's record also holds the key hires and the candidate bench.
- **"Missions due"** below the table: four missions. Each opens its brief (deterministic template: context, constraint, relevant Playbook entries, three opening questions, "What good looks like", "When you deliver"). Delivery goes to the founder's ledger in Engine for rating, and Captain proposes a Playbook lesson from the partner's notes, which feeds Rypples OS.

## S7b Founder programs · `/os/founder-programs`

**Tabs** (`?tab=`): Growth Readiness (default) · Ocean Scalers.

- **Growth Readiness:** no cohorts. A grid of companies by five modules (01 Buyer map, 02 Price and unit economics, 03 Pilot-to-contract terms, delivered through the Pilot to Contract program, 04 First sales hire, 05 Board-ready metrics, domain financing). Each cell is Not needed, Recommended, In progress or Done, with the output. Each module names the expert who delivers it. Footer: modules are recommended by each company's diagnostic and delivered from the 400-hour allocation; a finished module's output becomes evidence in the next diagnostic.
- **Ocean Scalers:**
  - Circle 02 composer: member cards, the composition rule, and the excluded list with reasons.
  - Buttons: "Send invitations" (event; label becomes "Invitations sent") and "Swap a member" (a menu of eligible companies; the choice is validated against the rule, with an inline warning if it breaks it, e.g. adding Flocean shows "Same market as Desolenator").
  - "Since session 2" commitments with status dots.
  - CEO development tile with Adri's line.

Talent has no page of its own: key hires show on each company's page (Programs tab for Anchor companies, a "Key hire" row for others) and in the People expert's record.

**Acceptance:** tabs and `?partner=` are linkable. Derived capacity matches seed. The swap rule rejects Flocean with the stated reason.

---

## S8 Pipeline · `/os/pipeline` (signature moment 2)

**Header:** eyebrow "Pipeline". H1 "Anchor-stage deals". Lede: "Each deal is diligenced with the same diagnostic the portfolio runs on, so the plan exists the day Rypples leads the round." Stats: "13 backed in 18 months" (derived; 14 after F7) and "10 a year to reach 100".

**Board:** five columns (Sourced, First meeting, Diligence, Investment committee, Led) with derived counts.

- Cards show the codename, vertical and region, and a note. Selecting a card opens it in the detail panel (`?deal=`).
- "Flagged this week (12)" expands the sourcing signals inline.

**Detail panel** for the selected deal:

- Stage, codename, what, "Open data room" (opens the demo Drive adapter's file list in a sheet, labelled "Demo connection").
- Proposed binding constraint with why and "From {n} items in the data room".
- "Day-one plan, if Rypples leads" (three drafts).
- "From the Growth Engine" (partner and lesson notes).
- Stage CTA: "Send to IC", "View diagnostic", "Request data room" or "Book first meeting". Each moves the deal one stage (`deal.moved`), except "View diagnostic", which opens the diligence diagnostic in a sheet.

**Signed becomes day one:**

- Dragging **Project Tern** into **Led**, or pressing the "Mark as led" button in its detail panel, which is the accessible path, opens a confirm dialog:
  - "Rypples leads Project Tern's round"
  - Fields, prefilled and illustrative: round close date (scenario date), board seat (yes), allocation (3 programs, 400 hours).
  - Primary "Start day one".
- This runs **F7** (`docs/07-ai.md`) with streamed `ProgressSteps` in the panel:
  1. Turning diligence into the plan
  2. Drafting the Growth Engine allocation
  3. Matching an operating partner (capacity check)
  4. Writing the schedule
  5. Opening Engine for Tern's founder
  6. Matching Playbook lessons
- **Result panel:**
  - Binding constraint (confirmed as proposed at IC).
  - Three priorities, each with a mission.
  - Allocation: Key Hire and Pilot to Contract, "130 of 400 hours".
  - Partner: "Maritime board-level partner moves to onboarding for Project Tern's board", with the note "Context pack assembled by Captain. Playbook briefing before the first board."
  - Deferred: "Plant and Fleet Finance Sprint deferred: the Finance expert has 30 hours left this quarter (second finance hire in final conversation)".
  - Links: "Open Project Tern in Engine →" (`/engine/tern`), "Open the company record →", "View the schedule →".
- Pipeline, Home, Portfolio (Tern appears as an anchor, marked "Added in this demo session") and the rail's "Board seats" all update in the session.
- Dragging any other deal into Led shows: "Only deals that have been through IC can be led. Send {codename} to IC first." Kelvin can move stage by stage, but F7 runs only for deals with diligence data (Tern). Others reaching Led show "Day-one plan needs a completed diligence diagnostic."

**Acceptance:**

- Drag works with a mouse and touch, and the button works with a keyboard.
- F7 completes in under 45 seconds live, or replays precomputed output in cached mode.
- All downstream screens reflect Tern in the session, and Reset removes it.
- The capacity outcomes match `lib/domain/capacity.ts` against seed: the Maritime board-level candidate moves to onboarding (eval checks `partner_onboarding: "bp-maritime"`), and the Finance Sprint is deferred.

---

## S9 Investor relations · `/os/investor-relations` (`/os/reporting` redirects)

**Header:** eyebrow "Investor relations". H1 "What shareholders see". Lede: "The shareholder update, impact across the portfolio, and the strategic path for each company. Drafted from approved records only, so every figure traces back."

**Tabs** (`?tab=`): Shareholder update · Impact · Strategic paths · Acceleration.

- **Shareholder update:**
  - A `Paper` draft, "Draft {n} · investor relations agent · Q4 2026 shareholder update · Built from {k} approved records." Every figure is an underlined reference. Clicking one opens a popover with the record type, value, provenance and a link.
  - Side panel "Before it goes": "You approve the draft. Figures that aren't approved records yet are held back, not guessed."
  - Buttons: "Redraft" (F6 live), "Edit" (inline paragraph edit), **primary "Approve and send"** (event; locks the draft and shows "Approved · sent to shareholders (demo)").
  - "Co-investors" note.
- **Impact:** Ocean Impact Navigator table (company, headline measure, status dot and text) and "About the framework" link.
- **Strategic paths:** table (company, relationships today, likely buyers and acquirers, program status), with the footnote that relationships come from public sources and buyer categories are hypotheses.
- **Acceleration (signature moment 4):**
  1. **The learning curve:** `LearningCurve` chart. x = cleared case (1 to 14, in clearance order). y = days to clear as a % of that domain's benchmark. Points in white 50%, a rolling median (window 4) as a lime line, and a dashed line at 100% labelled "Benchmark". Caption: "Each cleared constraint becomes a case. The median is falling: Rypples gets faster as the Playbook grows." Plus "Illustrative."
  2. **Domain selector** (eight chips): filters the curve to one domain and shows "{n} of 8 cases · benchmark switches to Rypples data at 8". People shows 5 of 8.
  3. **Benchmark table:** constraint, days, source, Rypples cases (x of 8), confidence.
  4. **How acceleration is measured:** three bullets. Then **what can't be measured**: "what a company would have done without Rypples. There's no true counterfactual, so these are signals, not proof."
  5. Note on outside references being placeholders until sourced.

**Acceptance:** every reference in the update resolves to a record. The chart renders from the `cleared_cases` seed, the domain filter works, and the rolling median is unit-tested.

---

## S10 Captain · drawer on any `/os/*` route (`?captain=1`), and a founder-scoped drawer in Engine

**Open:** the Ask Captain bar, ⌘K or Ctrl+K, or links that say "Open Captain". **Close:** Esc, the scrim or the close button. Focus is trapped while open.

**Contents (OS):**

1. Header: "Captain", with the meta "Works across Rypples OS, Engine and your connected tools".
2. **Overnight:** "Everything here waits for a person". Five items with status dots, each linking to its route, plus Approve / Review where relevant (the KPI requests have Approve, which records `proposal.approved`).
3. **Conversation:** message list. User messages are on the right in a well, Captain answers on the left in plain text.
   - Answers stream. Below an answer are **record and source chips** (Portfolio, Operating partners, Benchmarks, Meeting notes, or URLs).
   - Low-confidence caveats are shown inline.
   - "Suggested next steps" render as proposal rows with "needs your approval" and Approve / Dismiss buttons (events).
   - A meta line under each answer: "Read {n} records through the Rypples tool registry."
4. Suggested prompt chips, shown when the conversation is empty.
5. Input with send (Enter sends; Shift+Enter makes a new line).
6. **Connected strip:** Rypples OS, Engine, Drive, CRM, Meeting notes, Finance systems. Demo adapters show a "demo" tag on hover. There is also a link "Use Rypples from your own Claude →" (`/connect`).

**Seeded first exchange:** on first open in a session, the conversation shows the worked Q&A ("Which companies are behind their benchmark…" → Vessev 97 vs 90, Full Circle Biotechnology 118 vs 110, the low-confidence caveat, next steps). It is marked "From this morning", so Jerome sees the pattern before typing.

**Engine Captain:** placeholder "Ask Captain how other Rypples companies handled it". Founder-scoped tools only (`docs/08` §2). No overnight list; instead "Since you were last here" (lessons received, commitments delivered).

**Acceptance:** see `docs/07-ai.md` F3. Every factual answer has at least one record or source chip. A founder cannot retrieve another company's records, which is tested.

---

## S11 Engine home · `/engine/[slug]` (Desolenator; Tern after F7)

**Header:** "Monday 23 November" (scenario). Eyebrow "Rypples Engine". H1 "Good morning, Adri." Lede: "Your board meets on Thursday and the pack is already drafted from last quarter's numbers. Two things Rypples promised you are due this week."

1. **Board pack tile:**
   - Title "Board pack · Thursday 26 November".
   - Status "Drafted. Three sections need you." with a progress bar showing completed sections over total (derived).
   - Text: "Financials and KPIs are pulled in. You still need to write the CEO letter, confirm pilot status and add plant uptime."
   - **Primary "Finish board pack"** (→ S12).
2. **What we're clearing this quarter:**
   - "Plant capital" and its explanation. "Open plant capital" (→ S13).
   - **"I see it differently"** opens a short form (domain dropdown and a note). Submitting records `constraint.disputed`, shows "Sent to your board-level partner. They'll reply within two working days.", and adds a decision for Jerome on S1: "Adri sees the constraint differently".
3. **What Rypples owes you:** ledger table ("6 commitments · 2 delivered").
   - Delivered rows have a rating control (five steps) and show "After delivery" otherwise.
   - Note: "Everything Rypples has committed to. Rate it once it's delivered. Jerome sees your ratings."
   - Rating records `commitment.rated` and updates S4 and S2 averages in the session.
4. **From the Rypples network · new** (appears only when the WSense lesson has been sent to this company in the session; otherwise "Nothing new from the network this week"):
   - The lesson title, "why you" reason, "Read the play" (sheet with the play and timeline).
   - "Useful for us" (event; label becomes "Marked useful"; S6 library "helped" updates).
5. **Ocean Scalers · Circle 02:** next session, members, "Your commitment is done: plant capital stack shared".

**For Tern** (after F7): the same layout. The greeting is "Good morning." with "CEO, Project Tern". The board pack tile reads "Your first board pack will be drafted before your first board." The constraint is "A second production line". The ledger shows the F7 commitments. No lesson unless sent.

**Acceptance:** ratings persist in the session and appear in OS. The dispute flow creates the OS decision. The lesson appears only after a send.

---

## S12 Board pack · `/engine/[slug]/board-pack` (moment 11)

**Header:** breadcrumb "Home / Board pack, Q4". Meta "Saved {relative time}". Eyebrow "Board pack · Thursday 26 November". H1 "Drafted for you. Yours to finish."

**Actions:** "Preview PDF" (print view of the pack on `Paper`) and **primary "Share with the board"**. Share is disabled until no section is in a "Needs you" state. The tooltip lists what's left.

**Layout:**

- Left, section list (six), with state dots. Selecting a section loads it on the right.
- Right, the `Paper` preview of the section, with the kicker, title, source note, paragraphs and rows, and a "needs" panel with its CTA:
  - **CEO letter:** "Start writing" opens an editor. "Draft from my plan" runs **F5** (streams a first draft in the founder's voice, from the plan, ledger and last quarter's minutes). It is labelled "Draft · edit before sharing". "Mark ready" sets the state.
  - **Pilots:** "Confirm stages" opens a per-pilot stage select. Confirming records `pilot.stage_confirmed` and sets the section ready.
  - **Operations and uptime:** "Add data" opens a form (site, uptime %, output m³/day; values are session-scoped and labelled "Founder-entered"). Alternatively, "Connect plant telemetry" shows "Available when telemetry is connected", disabled with a tooltip. Do not fake a connection.
  - **Asks of the board:** "Redraft" runs F5 for this section. Editing is inline.
  - **Financials:** masked rows, with the note "From the finance system you connected (demo). Rypples never edits these."

**When you share** panel: three statements from the mockup, plus "Last quarter's pack took the team about two days. This one was drafted overnight." (I).

**On share:** the event is recorded. Engine home shows "Shared". The S4 Board history updates. A proposed `board_pack` diagnostic appears for Jerome in Captain overnight as "Diagnostic on Desolenator's Q4 pack ready to send to Adri" (precomputed F1 output reused).

**Acceptance:** sharing is blocked until the required sections are ready. F5 drafts stream and are editable. Nothing invents financial figures (eval-enforced).

---

## S13 Plant capital and customers · `/engine/[slug]/capital`

**Header:** eyebrow "Plant capital". H1 "Plant SPV #1, and the buyers behind it". Lede: "Two halves of scaling water-as-a-service: capital for each plant, and buyers who commit to more than one."

1. **Capital stack** (most junior at the top): five layers with who and status, and source "Republic deal note". The first-loss layer shows "Decision 31 Jan" and links to the ledger row.
2. **Where the money could come from:** five instruments, each with a "Shortlist" toggle (event). Note: "Candidates to verify".
3. **Where the next plants go:** the compact `MarketMap` with the top 5 markets (S4b component in compact mode) and a link "See all markets and adjust weights" (opens S4b in a sheet, founder-scoped).
4. **Pilot to contract:** a four-stage tracker per buyer ("Stages are yours to confirm"). Clicking a stage cell proposes a stage change, which is confirmed with a small popover and recorded as an event. Source chips: DEWA project, Silal project.

**Acceptance:** toggles and stage confirmations persist in the session and feed the S12 pilots section.

---

## S14 How Rypples works with you · `/engine/[slug]/how-rypples-works`

**Header:** eyebrow "How Rypples works with you". H1 "What anchoring your round comes with". Lede: "Rypples led your round, holds one board seat and a minority stake. Everything else is help you choose, and you measure it."

1. **Lifecycle:** "You're on day {N} of 100 · Round closed 15 Oct 2026". Four stages with founder-facing copy.
2. **Your Growth Engine allocation:** "{used} of 3 programs this year" and "{hours} of 400 operator hours" (derived). "Written into your term sheet, paid for by Rypples. Your board-level partner covers water and infrastructure." Link: "Read your Growth Engine schedule →" (S4c founder view).
3. **What Rypples promises:** three promise tiles.
4. **Programs you can draw on:**
   - The eight programs. Each card has the domain and length, name and outcome.
   - Card buttons: "Running" (disabled), "Proposed by your board-level partner" (accept → requested), or "Request".
   - Request records `program.requested` and increments "used". When used = total, the remaining Request buttons read "Allocation used · ask your board-level partner" and are disabled.
5. **Growth Readiness:** five modules. Desolenator's module 02 (Price and unit economics) is in progress inside the Finance Sprint; the others read "Available to request".

**Acceptance:** allocation arithmetic is derived and capped. Requests appear on S4 Programs for Jerome.

---

## `/connect` · Use Rypples from your own Claude (moment 5)

**Header:** eyebrow "Captain, anywhere". H1 "Rypples in your Claude". Lede: "The same tools Captain uses are published as a read-only MCP server over this demo's public data. Add it to Claude and ask about the portfolio from wherever you work."

1. **Server URL** in a copyable field: `{SITE_URL}/api/mcp`.
2. **Claude (web or desktop):** add the URL as a custom connector in Claude's connector settings. Keep the instructions generic and link to Anthropic's help article on custom connectors, rather than guessing a menu path.
3. **Claude Code:** `claude mcp add --transport http rypples {SITE_URL}/api/mcp`
4. **Try asking:** "Which portfolio companies are over their benchmark?", "What's Desolenator's binding constraint, with sources?", "Where should Desolenator's next three plants go?", "Which Playbook lessons apply to a company selling to ports?"
5. **What it can see:** the list of tools (from the registry metadata). "Read-only. Public and illustrative demo data only. No Rypples OS session data."

**Acceptance:** the URL copies. The tool list renders from the registry at build time. Verify the MCP server end to end with the MCP Inspector and with Claude Code before release.
