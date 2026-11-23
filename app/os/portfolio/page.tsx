import Link from "next/link";
import clsx from "clsx";
import { TopBar, Page } from "@/components/shell/TopBar";
import { DaysBar, EmptyState, Illustrative, Meta, PageHeader, Prov, Section, StatBlock, Tile } from "@/components/ui";
import { PortfolioNav } from "@/components/rypples/portfolio/PortfolioNav";
import { getState } from "@/lib/data";
import { getPortfolio, parsePortfolioParams, type PortfolioItem } from "@/lib/data/projections/portfolio";
import { getSessionId } from "@/lib/session";
import { numberWord } from "@/lib/scenario";

export const metadata = { title: "Portfolio" };

const COLS =
  "xl:grid xl:grid-cols-[minmax(170px,1.5fr)_minmax(96px,0.8fr)_72px_104px_minmax(150px,1.3fr)_minmax(160px,1.2fr)_64px_84px] xl:items-start xl:gap-x-4";

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { vertical, view } = parsePortfolioParams(sp);
  const s = await getState(await getSessionId());
  const p = getPortfolio(s, vertical);
  const fewer = p.unannounced === 1 ? "One more is" : `${numberWord(p.unannounced)} more are`;

  return (
    <>
      <TopBar crumbs={[{ label: "Portfolio" }]} placeholder="Ask Captain about the portfolio" />
      <Page>
        <PageHeader eyebrow="Portfolio" title={p.headline} />

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-10" aria-live="polite">
          <StatBlock value={p.stats.active} label="Active" />
          <StatBlock value={p.stats.exits} label="Exit" />
          <StatBlock value={p.stats.overBenchmark} label="Over benchmark" />
          <StatBlock
            value={p.stats.firmRating != null ? <Illustrative>{p.stats.firmRating.toFixed(1)}</Illustrative> : "None"}
            label="Founder rating"
          />
        </div>

        <PortfolioNav vertical={vertical} view={view} />

        {view === "table" ? (
          <Section>
            <div>
              <div className={clsx("hidden border-b border-line-2 pb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3", COLS)}>
                <span>Company</span>
                <span>Vertical</span>
                <span>Region</span>
                <span>Stage</span>
                <span>Binding constraint</span>
                <span>Days open</span>
                <span>Rates us</span>
                <span>Next board</span>
              </div>
              <ul>
                {p.items.map((i) => (
                  <Row key={i.slug} i={i} />
                ))}
                {p.exited.map((e) => (
                  <li key={e.slug} className={clsx("border-b border-line-2 py-[18px]", !e.matches && "opacity-25")}>
                    <div className="flex flex-col gap-1">
                      <Link href="/os/playbook" className="text-[15px] font-semibold text-ink hover:text-lime">
                        {e.name}
                      </Link>
                      <Meta>
                        Exited · {e.vertical}. Majority stake to Fincantieri, July 2026. Lessons in the Playbook.
                      </Meta>
                      <Link href="/os/playbook" className="text-link text-[13px]">
                        Open the lesson →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        ) : (
          <Section>
            <Tile className="py-2">
              <ul>
                {p.byDomain.map((d) => (
                  <li key={d.domain} className="grid gap-3 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-5">
                    <span className="text-[14px] font-medium text-ink">{d.label}</span>
                    {d.items.length === 0 ? (
                      <EmptyState>No company held here today</EmptyState>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {d.items.map((i) => (
                          <li key={i.slug} className={clsx(!i.matches && "opacity-25")}>
                            <Link
                              href={`/os/companies/${i.slug}`}
                              className={clsx(
                                "inline-flex rounded-btn border px-3 py-1.5 text-[13px] font-medium",
                                i.anchor ? "border-lime bg-lime-10 text-lime" : "border-line-2 bg-surface text-ink-2 hover:text-ink",
                              )}
                            >
                              {i.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Tile>
          </Section>
        )}

        <p className="meta max-w-[860px]">
          The {p.publicCount} companies on the public portfolio. {fewer} not yet announced. White tick marks the benchmark for that
          constraint. Every benchmark is an outside reference for now. Each switches to Rypples&rsquo; own data after eight cleared
          cases (see{" "}
          <Link href="/os/reporting?tab=acceleration" className="text-link">
            Reporting, Acceleration
          </Link>
          ). Dotted figures are illustrative.
        </p>
      </Page>
    </>
  );
}

function Row({ i }: { i: PortfolioItem }) {
  return (
    <li className={clsx("border-b border-line-2 py-[18px]", COLS, i.anchor && "bg-lime-6", !i.matches && "opacity-25")}>
      <div className="flex flex-col gap-1 max-xl:px-0 xl:pl-3">
        <Link href={`/os/companies/${i.slug}`} className="text-[15px] font-semibold text-ink hover:text-lime">
          {i.name}
        </Link>
        {i.tagline && <span className="text-[13px] text-ink-3">{i.tagline}</span>}
        {i.sessionAdded && <Meta>Added in this demo session</Meta>}
      </div>
      <span className="text-[13px] text-ink-2 max-xl:hidden">{i.vertical}</span>
      <span className="text-[13px] text-ink-2 max-xl:hidden">{i.region}</span>
      <span className="text-[13px] text-ink-2 max-xl:hidden">{i.stage}</span>
      <div className="flex flex-col gap-0.5 max-xl:mt-3">
        <span className="text-[13px] font-medium text-ink">{i.domainLabel}</span>
        {i.statement && <span className="text-[12px] text-ink-3">{i.statement}{i.provisional ? " (provisional)" : ""}</span>}
      </div>
      <div className="max-xl:mt-2">
        {i.daysOpen != null && i.benchmarkDays != null ? (
          <DaysBar
            days={i.daysOpen}
            benchmark={i.benchmarkDays}
            focus={i.anchor}
            label={
              <>
                <Prov p={i.constraintProvenance}>{i.daysOpen}</Prov> of {i.benchmarkDays} days ·{" "}
                <Link href="/os/reporting?tab=acceleration" className="underline underline-offset-2 hover:text-ink">
                  {i.benchmarkLabel}
                </Link>
              </>
            }
          />
        ) : (
          <Meta>No open constraint</Meta>
        )}
      </div>
      <span className="text-[13px] text-ink-2 max-xl:hidden">
        {i.rating != null ? <Illustrative>{i.rating.toFixed(1)}</Illustrative> : "Pending"}
      </span>
      <span className="text-[13px] text-ink-2 max-xl:hidden">{i.nextBoard}</span>
      <p className="meta mt-2 xl:hidden">
        {[i.vertical, i.region, i.stage].filter(Boolean).join(" · ")} · Rates us{" "}
        {i.rating != null ? <Illustrative>{i.rating.toFixed(1)}</Illustrative> : "pending"} · Next board {i.nextBoard}
      </p>
    </li>
  );
}
