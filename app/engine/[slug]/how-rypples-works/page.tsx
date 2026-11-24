import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { Illustrative, Meta, PageHeader, Prov, Section, StatBlock, StatusDot, TextLink, Tile } from "@/components/ui";
import { ProgramCards } from "@/components/rypples/bridge/ProgramCards";
import { getState } from "@/lib/data";
import { getHowItWorks } from "@/lib/data/projections/bridge";
import { getCompanyReadiness, READINESS_LABEL } from "@/lib/data/projections/founder-programs";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "How Rypples works" };
export const dynamic = "force-dynamic";

export default async function HowItWorksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getState(await getSessionId());
  const v = getHowItWorks(s, slug);
  if (!v) notFound();
  const a = v.allocation;
  const readiness = getCompanyReadiness(s, v.companyId);
  const yours = readiness.filter((m) => m.status !== "not_needed");
  const available = readiness.filter((m) => m.status === "not_needed");

  return (
    <>
      <TopBar crumbs={[{ label: "How Rypples works" }]} placeholder={`Ask Captain about ${v.companyName}`} />
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
              {a.partnerFocus && <> Your board-level partner, who works with your board, brings {a.partnerFocus} experience.</>}
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

        <Section id="readiness" title="Growth Readiness" meta="Recommended by your diagnostic">
          <Tile className="flex flex-col gap-5">
            {yours.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {yours.map((m) => (
                  <li key={m.id} className="grid gap-1 sm:grid-cols-[1fr_auto] sm:gap-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[15px] font-medium text-ink">
                        {m.n} · {m.name}
                      </span>
                      <span className="text-[13px] text-ink-2">{m.outcome}</span>
                      <Meta>
                        {m.expert ?? "Rypples"}
                        {m.via ? ` · through ${m.via}` : ""}
                        {m.note ? ` · ${m.note}` : ""}
                      </Meta>
                      {m.output && (
                        <span className="text-[13px] text-ink">
                          <Illustrative>{m.output}</Illustrative>
                        </span>
                      )}
                    </div>
                    <StatusDot tone={m.status === "done" ? "lime" : m.status === "in_progress" ? "amber" : "neutral"} label={READINESS_LABEL[m.status]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-2">Your diagnostic does not recommend a module yet.</p>
            )}
            {available.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line-2 pt-4">
                <span className="eyebrow">Available to request</span>
                <ul className="flex flex-wrap gap-2">
                  {available.map((m) => (
                    <li key={m.id} className="rounded-pill border border-line-2 px-2.5 py-[3px] text-[12px] text-ink-2">
                      {m.n} · {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Meta>Modules draw on your 400 operator hours. Ask your board-level partner to add one, and its output becomes evidence in your next diagnostic.</Meta>
          </Tile>
        </Section>

        <Section id="programs" title="Programs you can draw on" meta={`${a.programsUsed} of ${a.programsTotal} used`}>
          <ProgramCards companyId={v.companyId} programs={v.programs} used={a.programsUsed} total={a.programsTotal} />
        </Section>
      </Page>
    </>
  );
}
