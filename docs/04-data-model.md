# 04 · Data model

**Conventions:**

- Postgres in InsForge. Every table has `id text primary key` (stable slugs for seeded rows, `ulid` for created rows), `firm_id text not null` (seed: `rypples`), and `created_at timestamptz`.
- Every row that holds a claim or figure has `provenance text check (provenance in ('public','scenario','illustrative','generated'))`. Rows from AI also have `prompt_version`, `model` and `run_id`.
- Session overlays: tables that visitors can write to have `session_id text null`. Seed rows are `null`.
- Migrations are SQL files in `db/migrations`, applied in order with the InsForge CLI or SQL editor. Confirm the exact apply command in the InsForge docs. The zod schemas in `lib/domain/schemas` mirror each table, and seed files are validated against them.

## 1. Core

```sql
firms(id, name)

people(id, firm_id, kind,             -- 'rypples' | 'founder' | 'operator'
       name, title, initials,         -- operators: name null, role label in title
       company_id null, photo_path null, provenance)

companies(id, firm_id, slug unique, name, tagline, vertical, region,
          stage,                       -- 'Pilots' | 'First commercial' | 'Repeatable sales' | 'Exited'
          status,                      -- 'active' | 'exited' | 'unannounced' | 'pipeline' | 'prospect'
          website null, public bool,   -- on rypples.earth portfolio
          anchor bool, board_seat bool, round_closed_at date null,
          ceo_person_id null, codename bool default false,
          rating_seed numeric null,    -- illustrative "rates us" aggregate for companies without a seeded ledger
          next_board_label null,
          provenance, session_id null) -- session_id set for companies created by F7

sources(id, firm_id, url, title, publisher, kind,   -- 'company' | 'press' | 'deal' | 'dataset'
        accessed_at date, snapshot_path null)

documents(id, firm_id, company_id, source_id, title, kind, text, provenance)  -- source pack items

domains(id, slug, label, note, sort)   -- the 8-domain taxonomy, stored as data
```

## 2. Diagnosis and constraints

```sql
diagnostics(id, firm_id, company_id null, run_id,
            kind,                      -- 'board_pack' | 'public' | 'diligence' | 'any_company'
            status,                    -- 'proposed' | 'confirmed' | 'disputed'
            binding_domain_id null, binding_statement null,
            questions jsonb,           -- ["...", "...", "..."]
            program_ids text[], lesson_ids text[],
            confirmed_by null, confirmed_at null,
            prompt_version, model, provenance, session_id null)

dimension_scores(id, diagnostic_id, domain_id,
                 score int null check (score between 1 and 5),   -- null = evidence gap
                 confidence,           -- 'low' | 'medium' | 'high'
                 finding, evidence_ids text[], is_binding bool)

evidence(id, firm_id, company_id null, run_id null,
         source_id null, document_id null,
         url, title, cited_text,       -- cited_text ≤ 150 chars, verbatim from citation
         claim,                        -- one-sentence paraphrase
         location jsonb null,          -- char range / page in a document snapshot
         provenance)

company_constraints(id, firm_id, company_id, domain_id, statement,
                    opened_at date, cleared_at date null,
                    confirmed_by, provenance, session_id null)   -- one open row per company

benchmarks(id, domain_id, days, source_kind,   -- 'outside' | 'blended' | 'rypples'
           source_note, confidence, provenance)

cleared_cases(id, domain_id, case_label,       -- "Case 1"… anonymised, never a real company name
              cleared_seq int, days int, cleared_on date, provenance)
```

**Benchmark rule** (`lib/domain/benchmarks.ts`): for each domain, if `count(cleared_cases where domain) >= 8`, use the Rypples median of those cases (`source_kind = 'rypples'`). Otherwise use the seeded outside or blended value. "Days open" = `scenarioDate − opened_at`. "Over benchmark" = days open > the benchmark days for that domain.

## 3. Growth Engine

```sql
programs(id, slug, name, domain_id, length_weeks, outcome, delivered_by_role, provenance)

allocations(id, firm_id, company_id, year, programs_total int, hours_total int,
            source,                    -- 'term_sheet'
            provenance, session_id null)

enrolments(id, firm_id, company_id, program_id,
           status,                     -- 'proposed' | 'requested' | 'running' | 'done'
           week int null, of_weeks int null, hours int, operator_id null,
           rating numeric null, provenance, session_id null)

operators(id, firm_id, initials, role, focus,
          seats_total int null, seats_used int null,          -- board partners
          hours_quarter int, hours_committed int,             -- experts
          rating numeric, open_missions int, delivered int, provenance)

operator_coverage(operator_id, company_id)

missions(id, firm_id, company_id, priority_id null, title, operator_id, due_offset int,
         status, provenance, session_id null)

commitments(id, firm_id, company_id, title, from_label, operator_id null,
            due_label, due_offset int null,
            status,                    -- 'not_started' | 'in_progress' | 'open' | 'delivered'
            rating int null, provenance, session_id null)

talent_roles(id, company_id, role, why, state, provenance)
bench_groups(id, label, n, provenance)
partner_recruiting(id, role, state, note, provenance)
ceo_development(id, company_id, note, provenance)

circles(id, name, theme, session_n, of_n, next_at timestamptz, provenance)
circle_members(circle_id, company_id)
circle_exclusions(circle_id, company_id, reason)
circle_commitments(id, circle_id, company_id, text, status, provenance)

readiness_modules(id, n, name, outcome, domain_id)
```

**Capacity rule** (`lib/domain/capacity.ts`): a board partner can take a new company if `seats_used < seats_total`. An expert can take a program if `hours_committed + program_hours ≤ hours_quarter`. Firm capacity = sum of committed hours over the sum of quarterly hours (seed: 1,180 of 1,600). Program hours are derived from length: Plant and Fleet Finance Sprint is 60h, and the others follow `docs/05-seed-data.md` §6.

## 4. Plans

```sql
plans(id, firm_id, company_id, from_diagnostic_id, status, provenance, session_id null)
priorities(id, plan_id, rank int, title, domain_id)
lifecycle_stages(id, company_id, key,  -- 'day0' | 'first100' | 'quarterly' | 'strategic'
                 status, label, note, provenance)
board_meetings(id, company_id, at_offset int, label)
decisions(id, firm_id, company_id null, context_label, question, line, route,
          status, provenance, session_id null)
agenda_items(id, firm_id, at_offset int, title, note, route, provenance)
```

## 5. Playbook

```sql
lessons(id, firm_id, title, domain_id, learned_in, play text[], timeline jsonb,
        source_ids text[], status, approved_by null, provenance)
lesson_matches(id, lesson_id, company_id, reason, status,   -- 'matched' | 'sent'
               useful bool null, provenance, session_id null)
library_stats(lesson_id, sent int, helped int, provenance)  -- "Helped 3 of 4"
intake_sessions(id, firm_id, kind, title, who_label, held_offset int, outcome,
                confidential bool, proposed_lesson_id null, provenance)
replay_steps(id, lesson_id, at date, event, source_id, platform_read, provenance)
     -- platform_read = how the platform would have read it (illustrative)
```

## 6. Pipeline

```sql
deals(id, firm_id, codename, vertical, region,
      stage,                          -- 'sourced' | 'first_meeting' | 'diligence' | 'ic' | 'led'
      note, what, proposed_constraint, constraint_domain_id null, why, evidence_count int,
      plan_drafts text[], partner_note, lesson_note, cta_label,
      diligence jsonb null,           -- evidence + scores used by F7 (Tern only)
      provenance, session_id null)
sourcing_signals(id, codename, vertical, region, signal, provenance)
```

## 7. Founder side (Bridge)

```sql
board_packs(id, company_id, quarter, meeting_offset int, status, provenance, session_id null)
board_pack_sections(id, pack_id, key, sort, name, state, kicker, title, source_note,
                    paragraphs text[], rows jsonb, needs bool, need_text, need_cta,
                    content_md null, provenance, session_id null)
capital_layers(id, company_id, sort, name, who, status, provenance)
instruments(id, company_id, key, name, why, shortlisted bool, provenance, session_id null)
pilots(id, company_id, name, note, stage int, source_id null, provenance, session_id null)
promises(id, firm_id, title, text)
```

## 8. Reporting and impact

```sql
impact_kpis(id, company_id, kpi, status, provenance)          -- Ocean Impact Navigator
strategic_paths(id, company_id, now, likely, program_status, provenance)
shareholder_updates(id, firm_id, quarter, status, draft jsonb, provenance, session_id null)
    -- draft = [{ kind:'text'|'ref', text, record:{type,id,field} }]
```

## 9. Geodata

`markets` is read from `data/geo/markets.json` through `GeoRepository`. It is not a table. Schema in `docs/09-geodata.md` §3.

## 10. AI bookkeeping

```sql
agent_runs(id, firm_id, flow, input jsonb, status, started_at, finished_at,
           model, prompt_version, usage jsonb, searches int, fetches int,
           est_cost_usd numeric, mode,      -- 'live' | 'cached' | 'precomputed'
           session_id null, ip_hash null)

proposals(id, firm_id, flow, kind, target_type, target_id, payload jsonb,
          status,                           -- 'proposed' | 'approved' | 'rejected'
          approved_by null, approved_at null,
          sources jsonb, run_id, prompt_version, model, provenance, session_id null)

any_company_runs(id, domain unique, display_name, status,  -- 'ok' | 'declined' | 'insufficient'
                 result jsonb, run_id, created_at)          -- shared cache, 7-day TTL logic in code

captain_messages(id, session_id, viewer_kind, company_id null, role, content jsonb, run_id, created_at)
```

## 11. Event log

```sql
events(id, firm_id, session_id null, actor,  -- 'jerome' | 'adri' | 'founder:tern' | 'agent:<flow>'
       type, entity_type, entity_id, payload jsonb, at timestamptz)
```

Append-only. There are no updates or deletes from the app. Event types:

| Type | Effect in projection |
|---|---|
| `decision.resolved` | Decision leaves "Needs your decision". Home count decrements |
| `constraint.confirmed` / `constraint.disputed` | Diagnostic status. "I see it differently" opens a note to the board partner |
| `commitment.rated` | Ledger rating. Company and firm rating averages update |
| `program.requested` | Enrolment `requested`. Allocation "used" count updates (capped at the total) |
| `lesson.approved` | Lesson `approved`. Send buttons enable |
| `lesson.sent` | Match `sent`. Recipient's Bridge home shows the lesson |
| `lesson.useful` | Founder marked it useful. Library "helped" updates |
| `instrument.shortlisted` / `.unshortlisted` | Bridge capital toggles |
| `pilot.stage_confirmed` | Board pack pilots section state |
| `board_pack.section_saved` / `board_pack.shared` | Board pack state. Sharing creates a `board_pack` diagnostic proposal for Rypples |
| `proposal.approved` / `proposal.rejected` | Captain next steps and overnight items |
| `shareholder_update.approved` | Draft locked, "Approved" state |
| `circle.invites_sent` | Ocean Scalers state |
| `deal.moved` | Deal stage |
| `deal.led` | F7 output: creates company, constraint, plan, allocation, enrolments, commitments, schedule, lifecycle, Bridge workspace (all session-scoped). Home counts update (14 backed in session) |

## 12. Projections

`lib/data/projections/*` exposes view models per screen: `getHome(viewer)`, `getPortfolio(viewer)`, `getCompany(viewer, slug)`, `getBridgeHome(viewer, slug)` and so on. Each one:

1. reads seed rows plus rows with the current `session_id`;
2. folds the session's events in time order;
3. computes derived values with `lib/domain` functions.

Projections are the only thing pages consume. They are unit-tested against the fixture repository.
