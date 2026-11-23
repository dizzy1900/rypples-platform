import Link from "next/link";
import clsx from "clsx";
import {
  ButtonLink,
  DaysBar,
  EmptyState,
  H1,
  Illustrative,
  Pill,
  Prov,
  ScoreBar,
  Section,
  SourceChip,
  TextLink,
  Tile,
} from "@/components/ui";
import { UrlTabs } from "@/components/ui/client";
import { PreRead } from "./PreRead";
import { BoardTab, DiagnosticTab, LedgerTab, MarketTab, ProgramsTab, RisksTab } from "./Tabs";
import type { CompanyTab, F2Rows, getCompanyView } from "@/lib/data/projections/company";

type View = NonNullable<ReturnType<typeof getCompanyView>>;
type Full = Extract<View, { kind: "full" }>;
type Standard = Extract<View, { kind: "standard" }>;
type Exited = Extract<View, { kind: "exited" }>;

type MarketData = Parameters<typeof MarketTab>[0]["markets"];

function Pills({ h, stage }: { h: Full["head"]; stage?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {h.vertical && <Pill>{h.vertical}</Pill>}
      {h.region && <Pill>{h.region}</Pill>}
      {stage && h.stage && <Pill grey>{h.stage}</Pill>}
    </div>
  );
}

/** A meta fragment whose source chip appears on hover or focus. */
function FactBit({ text, source, note }: Full["meta"][number]) {
  return (
    <span className="group relative inline-block" tabIndex={source ? 0 : undefined}>
      <span className={clsx(source && "cursor-help border-b border-dotted border-ink-4")}>{text}</span>
      {source && (
        <span className="absolute left-0 top-full z-20 hidden pt-1.5 group-focus-within:block group-hover:block">
          <span className="flex w-max max-w-[min(340px,80vw)] flex-col gap-1.5 rounded-item border border-line-2 bg-panel p-2.5 shadow-[var(--shadow-sheet)]">
            <SourceChip href={source.href} label={source.label} />
            {note && <span className="text-[12px] font-normal leading-[1.4] text-ink-2">{note}</span>}
          </span>
        </span>
      )}
    </span>
  );
}

export function FullView({ v, tab, markets }: { v: Full; tab: CompanyTab; markets: MarketData }) {
  const h = v.head;
  const lc = v.lifecycle;
  return (
    <>
      <header className="flex flex-col gap-4">
        <Pills h={h} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <H1>{h.name}</H1>
            {h.tagline && <p className="text-[18px] font-medium text-lime">{h.tagline}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={`/bridge/${h.slug}`}>See {v.ceoFirst}&rsquo;s view in Bridge</ButtonLink>
            <ButtonLink variant="primary" href={`/os/companies/${h.slug}/diagnostic`}>
              Run diagnostic
            </ButtonLink>
          </div>
        </div>
        {v.meta.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
            {v.meta.map((m, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="text-ink-4">·</span>}
                <FactBit {...m} />
              </span>
            ))}
          </p>
        )}
      </header>

      {lc.stages.length > 0 && (
        <Tile>
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-col gap-1">
                {lc.day != null && <h2 className="font-display text-[26px] font-medium tracking-[-0.02em] text-ink">Day {lc.day} of the first 100</h2>}
                {lc.scenarioLine && <p className="text-[13px] text-ink-3">{lc.scenarioLine}</p>}
              </div>
              <a href={`/bridge/${h.slug}/how-rypples-works`} target="_blank" rel="noopener noreferrer" className="text-link text-[13px]">
                How Rypples works with founders →
              </a>
            </div>
            <ol className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {lc.stages.map((st) => (
                <li
                  key={st.key}
                  aria-current={st.current ? "step" : undefined}
                  className={clsx("flex flex-col gap-1.5 border-t-2 pt-3", st.current ? "border-lime" : "border-line-2")}
                >
                  <span className={clsx("text-[14px] font-semibold", st.current ? "text-ink" : "text-ink-2")}>{st.label}</span>
                  <span className={clsx("meta", st.current && "text-lime")}>{st.when}</span>
                  <span className="text-[13px] text-ink-3">{st.note}</span>
                </li>
              ))}
            </ol>
          </div>
        </Tile>
      )}

      {v.preRead && (
        <Section
          id="preread"
          title={v.preRead.boardWeekday ? `Before ${v.preRead.boardWeekday}'s board` : "Before the board"}
          meta={v.preRead.meta}
        >
          <Tile>
            <PreRead
              binding={v.preRead.binding}
              questions={v.preRead.questions}
              decision={v.preRead.decision}
              layers={v.preRead.layers}
              layersSource={v.preRead.layersSource}
            />
          </Tile>
        </Section>
      )}

      <div className="flex flex-col gap-6">
        <UrlTabs tabs={v.tabs} current={tab} label={`${h.name} record`} />
        {tab === "diagnostic" && <DiagnosticTab v={v} />}
        {tab === "risks" && <RisksTab v={v} />}
        {tab === "market" && <MarketTab markets={markets} />}
        {tab === "programs" && <ProgramsTab v={v} />}
        {tab === "ledger" && <LedgerTab v={v} />}
        {tab === "board" && <BoardTab v={v} />}
      </div>
    </>
  );
}

export function StandardView({ v, f2 }: { v: Standard; f2: F2Rows | null }) {
  const h = v.head;
  const k = v.constraint;
  return (
    <>
      <header className="flex flex-col gap-4">
        <Pills h={h} stage />
        <H1>{h.name}</H1>
        {h.tagline && <p className="text-[18px] font-medium text-lime">{h.tagline}</p>}
        {h.website && (
          <p>
            <TextLink href={h.website} external>
              {h.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗
            </TextLink>
          </p>
        )}
      </header>

      <Section id="constraint" title="Binding constraint">
        <Tile className="flex flex-col gap-4">
          {k ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="eyebrow">{k.domain}{k.provisional ? " · provisional" : ""}</span>
                <p className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">{k.statement}</p>
              </div>
              {k.days != null && k.benchmark != null && (
                <div className="max-w-[420px]">
                  <DaysBar
                    days={k.days}
                    benchmark={k.benchmark}
                    label={
                      <>
                        <Prov p={k.provenance}>{k.days}</Prov> of {k.benchmark} days ·{" "}
                        <Link href="/os/reporting?tab=acceleration" className="underline underline-offset-2 hover:text-ink">
                          {k.benchmarkLabel}
                        </Link>
                      </>
                    }
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState>No open constraint.</EmptyState>
          )}
        </Tile>
      </Section>

      <Section id="public" title="What public sources show" meta={f2 ? `From public sources${f2.runDate ? ` · run ${f2.runDate}` : ""} · proposed` : undefined}>
        {f2 ? (
          <ul>
            {f2.rows.map((r) => (
              <li key={r.domain} className="grid gap-2 border-b border-line-2 py-4 lg:grid-cols-[200px_190px_1fr] lg:gap-6">
                <span className="text-[14px] font-medium text-ink">{r.label}</span>
                <span className="flex items-start">
                  <ScoreBar score={r.score} label={r.label} />
                </span>
                <div className="flex flex-col gap-2">
                  <p className="text-[14px] text-ink-2">{r.score == null ? "No public evidence found." : r.finding}</p>
                  {r.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {r.sources.map((s) => (
                        <SourceChip key={s.href} href={s.href} label={s.label} />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <EmptyState>No reviewed public-source run yet.</EmptyState>
            <ButtonLink href={`/os/diagnostic/new?q=${encodeURIComponent(h.name)}`}>Run it live</ButtonLink>
          </div>
        )}
        {f2 && (
          <div>
            <ButtonLink href={`/os/diagnostic/new?q=${encodeURIComponent(h.name)}`}>Run again live</ButtonLink>
          </div>
        )}
      </Section>

      <Section id="facts" title="Rating, board and path">
        <Tile className="py-2">
          <dl className="flex flex-col">
            <Row k="Rates Rypples">
              {v.rating != null ? <><Illustrative>{v.rating.toFixed(1)}</Illustrative> / 5</> : "Pending"}
            </Row>
            <Row k="Next board">{v.nextBoard ?? "Not scheduled"}</Row>
            <Row k="Strategic path">
              {v.path ? (
                <span className="flex flex-col gap-1.5">
                  <span>
                    Now: <Prov p={v.path.nowProvenance}>{v.path.now}</Prov>
                    {v.path.source && (
                      <>
                        {" "}
                        <SourceChip href={v.path.source.href} label={v.path.source.label} />
                      </>
                    )}
                  </span>
                  <span className="text-ink-3">
                    Likely: <Illustrative>{v.path.likely}</Illustrative> · Program: {v.path.status}
                  </span>
                </span>
              ) : (
                <span className="text-ink-3">Not mapped yet</span>
              )}
            </Row>
            <Row k="Impact KPI">
              {v.kpi ? (
                <>
                  <Illustrative>{v.kpi.text}</Illustrative> · {v.kpi.status === "reported" ? "Reported" : v.kpi.status === "in_progress" ? "In progress" : "Not yet"}
                </>
              ) : (
                <span className="text-ink-3">Not yet defined</span>
              )}
            </Row>
          </dl>
        </Tile>
      </Section>
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-5">
      <dt className="meta uppercase tracking-[0.12em]">{k}</dt>
      <dd className="text-[14px] text-ink-2">{children}</dd>
    </div>
  );
}

export function ExitedView({ v }: { v: Exited }) {
  const h = v.head;
  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {h.vertical && <Pill>{h.vertical}</Pill>}
          {h.region && <Pill>{h.region}</Pill>}
          <Pill grey>Exited</Pill>
        </div>
        <H1>{h.name}</H1>
        {h.tagline && <p className="text-[18px] font-medium text-lime">{h.tagline}</p>}
        {h.website && (
          <p>
            <TextLink href={h.website} external>
              {h.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗
            </TextLink>
          </p>
        )}
      </header>
      <Section id="exit" title="Exit">
        <Tile className="flex flex-col gap-3">
          {v.note && <p className="text-[15px] text-ink">{v.note}</p>}
          {v.path && (
            <p className="text-[14px] text-ink-2">
              {v.path.now}{" "}
              {v.path.source && <SourceChip href={v.path.source.href} label={v.path.source.label} />}
            </p>
          )}
          <p className="text-[14px] text-ink-2">The path from strategic investor to acquirer became a lesson in the Playbook.</p>
          <div>
            <ButtonLink href="/os/playbook">Replay the WSense lesson</ButtonLink>
          </div>
        </Tile>
      </Section>
    </>
  );
}
