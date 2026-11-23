import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { EmptyState, Illustrative, PageHeader, Section, StatusDot, Tile, cx } from "@/components/ui";
import { PackActions } from "@/components/rypples/bridge/PackActions";
import { SectionPanel } from "@/components/rypples/bridge/SectionPanel";
import { getState } from "@/lib/data";
import { getBoardPackView } from "@/lib/data/projections/bridge";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Board pack" };
export const dynamic = "force-dynamic";

export default async function BoardPackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { slug } = await params;
  const { section: sectionParam } = await searchParams;
  const s = await getState(await getSessionId());
  const v = getBoardPackView(s, slug);
  if (!v) notFound();
  const base = `/bridge/${slug}`;

  if (!v.pack) {
    return (
      <>
        <TopBar crumbs={[{ label: "Home", href: base }, { label: "Board pack" }]} placeholder={`Ask Captain about ${v.companyName}`} />
        <Page>
          <PageHeader eyebrow="Board pack" title="Your first board pack" lede="Your first board pack will be drafted before your first board." />
          <Section>
            <Tile>
              <EmptyState>Once your first board is set, Bridge drafts the pack from your plan and ledger. You finish and share it from here.</EmptyState>
            </Tile>
          </Section>
        </Page>
      </>
    );
  }

  const { pack, sections } = v;
  const current = sections.find((x) => x.key === sectionParam) ?? sections.find((x) => x.needs) ?? sections[0];

  return (
    <>
      <TopBar
        crumbs={[{ label: "Home", href: base }, { label: `Board pack, ${pack.quarterShort}` }]}
        placeholder={`Ask Captain about ${v.companyName}`}
      />
      <Page>
        <PageHeader
          eyebrow={`Board pack · ${pack.meetingLabel}`}
          title="Drafted for you. Yours to finish."
          actions={
            <PackActions
              packId={pack.id}
              companyId={v.companyId}
              companyName={v.companyName}
              heading={`Board pack · ${pack.quarter} · ${pack.meetingLabel}`}
              sections={sections}
              blockers={v.blockers}
              shared={pack.shared}
            />
          }
        >
          <p className="meta">{pack.saved}</p>
        </PageHeader>

        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Board pack sections" className="no-print">
            <ol className="flex flex-col">
              {sections.map((sec, i) => {
                const active = sec.key === current.key;
                return (
                  <li key={sec.key} className="border-b border-line-2 first:border-t">
                    <Link
                      href={`${base}/board-pack?section=${sec.key}`}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cx("flex flex-col gap-1 border-l-2 px-3 py-3.5 transition-colors", active ? "border-lime bg-lime-10" : "border-transparent hover:bg-surface")}
                    >
                      <span className={cx("text-[14px] font-medium", active ? "text-ink" : "text-ink-2")}>
                        {i + 1}. {sec.name}
                      </span>
                      <StatusDot tone={sec.state === "ready" ? "lime" : sec.state === "needs" ? "amber" : "neutral"} label={sec.stateLabel} className="text-[12px]" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <SectionPanel
            key={current.key}
            packId={pack.id}
            companyId={v.companyId}
            section={current}
            pilots={v.pilots}
            stages={v.stages}
          />
        </div>

        <Section id="share" title="When you share">
          <Tile className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2 text-[14px] text-ink">
              {pack.statements.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            <p className="text-[14px]">
              <Illustrative>Last quarter&rsquo;s pack took the team about two days. This one was drafted overnight.</Illustrative>
            </p>
          </Tile>
        </Section>
      </Page>
    </>
  );
}
