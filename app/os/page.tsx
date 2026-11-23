import Link from "next/link";
import { TopBar, Page } from "@/components/shell/TopBar";
import { DecisionRow, EmptyState, Illustrative, Meta, PageHeader, Section, TextLink, Tile } from "@/components/ui";
import { OpenCaptainButton } from "@/components/ui/client";
import { DotGrid } from "@/components/rypples/DotGrid";
import { getState } from "@/lib/data";
import { getHome } from "@/lib/data/projections/home";
import { getSessionId } from "@/lib/session";
import { greeting } from "@/lib/scenario";

export const metadata = { title: "Home" };

export default async function OsHome() {
  const s = await getState(await getSessionId());
  const h = getHome(s);
  const maxStuck = Math.max(1, ...h.stuck.map((g) => g.count));
  return (
    <>
      <TopBar crumbs={[{ label: "Home" }]} placeholder="Ask Captain about the portfolio" />
      <Page>
        <PageHeader eyebrow="Your brief" title={`Good ${greeting()}, Jerome.`} lede={h.lede}>
          <p className="text-[13px] text-ink-3">
            Captain prepared this brief overnight from {h.records} records.{" "}
            <OpenCaptainButton>Open Captain →</OpenCaptainButton>
          </p>
        </PageHeader>

        <Section
          id="decisions"
          title="Needs your decision"
          aside={<span className="meta">{h.decisions.length} open</span>}
        >
          <Tile className="py-2">
            {h.decisions.length === 0 ? (
              <div className="py-4">
                <EmptyState>Nothing waiting for you. Captain will add decisions here as they come up.</EmptyState>
              </div>
            ) : (
              h.decisions.map((d) => (
                <DecisionRow
                  key={d.id}
                  context={d.context_label}
                  question={d.question}
                  line={d.line}
                  action={<TextLink href={d.route}>{d.action_label}</TextLink>}
                />
              ))
            )}
          </Tile>
        </Section>

        <div className="grid gap-8 xl:grid-cols-2">
          <Section id="plan" title="The plan so far">
            <Tile className="flex flex-wrap items-start gap-8">
              <DotGrid dots={h.dots} />
              <div className="flex min-w-[200px] flex-1 flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <span className="big-number">{h.counts.backed}</span>
                  <span className="meta">of 100 ocean-positive companies</span>
                </div>
                <ul className="flex flex-col gap-2 text-[13px]">
                  <li className="flex items-center gap-2.5">
                    <span className="h-[10px] w-[10px] rounded-full bg-lime" aria-hidden />
                    {h.counts.active - h.counts.unannounced} active
                    {h.counts.active - h.counts.unannounced > h.counts.activePublic && " (incl. this session)"}
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="h-[10px] w-[10px] rounded-full bg-[rgb(172_207_9/0.45)]" aria-hidden />
                    {h.counts.unannounced} active, not yet announced
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="h-[10px] w-[10px] rounded-full border-[1.5px] border-lime" aria-hidden />
                    {h.counts.exits} exit: WSense to Fincantieri, July 2026
                  </li>
                </ul>
                <div className="border-t border-line-2 pt-4">
                  <p className="text-[13px] text-ink-2">
                    Founders&rsquo; rating of Rypples{" "}
                    <span className="font-display text-[22px] text-ink">
                      <Illustrative note="Mean of company ratings">{h.counts.firmRating?.toFixed(1)}</Illustrative>
                    </span>{" "}
                    / 5
                  </p>
                </div>
              </div>
            </Tile>
          </Section>

          <Section id="stuck" title="Where the portfolio is stuck" aside={<TextLink href="/os/portfolio?view=map">Open portfolio →</TextLink>}>
            <Tile className="flex flex-col gap-5">
              {h.stuck.map((g) => (
                <div key={g.domain} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-ink">{g.label}</span>
                    <span className="font-display text-[20px] text-ink">{g.count}</span>
                  </div>
                  <div className="h-[6px] w-full rounded-full bg-off" aria-hidden>
                    <div
                      className={g.hasBoardSeat ? "h-full rounded-full bg-lime" : "h-full rounded-full bg-[rgb(255_255_255/0.5)]"}
                      style={{ width: `${(g.count / maxStuck) * 100}%` }}
                    />
                  </div>
                  <Meta>{g.companies.map((c) => c.name).join(", ")}</Meta>
                </div>
              ))}
            </Tile>
          </Section>
        </div>

        <Section id="week" title="This week">
          <Tile className="py-2">
            <ul>
              {h.agenda.map((a) => (
                <li key={a.id} className="border-b border-line-2 last:border-b-0">
                  <Link
                    href={a.route}
                    className="grid grid-cols-[100px_1fr] gap-4 py-4 hover:text-ink sm:grid-cols-[120px_1fr_auto] sm:items-baseline"
                  >
                    <span className="meta uppercase tracking-[0.12em]">{a.when}</span>
                    <span className="flex flex-col">
                      <span className="text-[14px] font-medium text-ink">{a.title}</span>
                      <span className="text-[13px] text-ink-3">{a.note}</span>
                    </span>
                    <span className="text-link text-[13px] max-sm:hidden">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Tile>
        </Section>
      </Page>
    </>
  );
}
