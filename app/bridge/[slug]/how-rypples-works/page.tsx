import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { Meta, PageHeader, Prov, Section, StatBlock, StatusDot, TextLink, Tile } from "@/components/ui";
import { ProgramCards } from "@/components/rypples/bridge/ProgramCards";
import { getState } from "@/lib/data";
import { getHowItWorks } from "@/lib/data/projections/bridge";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "How Rypples works" };
export const dynamic = "force-dynamic";

export default async function HowItWorksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getState(await getSessionId());
  const v = getHowItWorks(s, slug);
  if (!v) notFound();
  const base = `/bridge/${slug}`;
  const a = v.allocation;

  return (
    <>
      <TopBar crumbs={[{ label: "Home", href: base }, { label: "How Rypples works" }]} placeholder={`Ask Captain about ${v.companyName}`} />
      <Page>
        <PageHeader
          eyebrow="How Rypples works with you"
          title="What anchoring your round comes with"
          lede="Rypples led your round, holds one board seat and a minority stake. Everything else is help you choose, and you measure it."
        />

        <Section id="lifecycle" title="Lifecycle" meta={v.dayLine ?? undefined}>
          <Tile>
            <ol className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {v.stages.map((st) => (
                <li key={st.key} className="flex flex-col gap-2">
                  <StatusDot
                    tone={st.status === "done" ? "lime" : st.status === "in_progress" ? "amber" : "neutral"}
                    label={st.status === "done" ? "Done" : st.status === "in_progress" ? "In progress" : st.status === "always_on" ? "Always on" : "Upcoming"}
                    className="text-[12px]"
                  />
                  <span className="text-[15px] font-medium text-ink">{st.label}</span>
                  <Meta>
                    <Prov p={st.provenance}>{st.when}</Prov>
                  </Meta>
                  <p className="text-[13px]">{st.note}</p>
                </li>
              ))}
            </ol>
          </Tile>
        </Section>

        <Section id="allocation" title="Your Growth Engine allocation">
          <Tile className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <StatBlock
                value={
                  <Prov p={a.provenance}>
                    {a.programsUsed} of {a.programsTotal}
                  </Prov>
                }
                label="programs this year"
              />
              <StatBlock
                value={
                  <Prov p={a.provenance}>
                    {a.hoursUsed} of {a.hoursTotal}
                  </Prov>
                }
                label={a.requestedHours > 0 ? `operator hours · ${a.requestedHours} more requested` : "operator hours"}
              />
            </div>
            <p className="max-w-[640px] text-[14px]">
              Written into your term sheet, paid for by Rypples.
              {a.partnerFocus && <> Your board partner covers {a.partnerFocus}.</>}
            </p>
            <div>
              <TextLink href={v.scheduleHref}>Read your Growth Engine schedule →</TextLink>
            </div>
          </Tile>
        </Section>

        <Section id="promises" title="What Rypples promises">
          <Tile>
            <ul className="grid gap-6 md:grid-cols-3 md:divide-x md:divide-[var(--color-line-2)]">
              {v.promises.map((p) => (
                <li key={p.id} className="flex flex-col gap-1.5 md:pl-6 md:first:pl-0">
                  <span className="font-display text-[18px] font-medium tracking-[-0.01em] text-ink">{p.title}</span>
                  <span className="text-[13px]">{p.text}</span>
                </li>
              ))}
            </ul>
          </Tile>
        </Section>

        <Section id="programs" title="Programs you can draw on" meta={`${a.programsUsed} of ${a.programsTotal} used`}>
          <ProgramCards companyId={v.companyId} programs={v.programs} used={a.programsUsed} total={a.programsTotal} />
        </Section>
      </Page>
    </>
  );
}
