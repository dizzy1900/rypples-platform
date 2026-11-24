import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { ButtonLink, Illustrative, Meta, PageHeader, Prov, Section, StatusDot, Table, Td, TextLink, Th, Tile, EmptyState } from "@/components/ui";
import { DisputeForm } from "@/components/rypples/bridge/DisputeForm";
import { LessonCard } from "@/components/rypples/bridge/LessonCard";
import { RatingControl } from "@/components/rypples/bridge/RatingControl";
import { getState } from "@/lib/data";
import { getBridgeHome } from "@/lib/data/projections/bridge";
import { getSessionId } from "@/lib/session";
import { greeting } from "@/lib/scenario";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function BridgeHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getState(await getSessionId());
  const h = getBridgeHome(s, slug);
  if (!h) notFound();
  const base = `/engine/${slug}`;
  const title = h.founderFirst ? `Good ${greeting()}, ${h.founderFirst}.` : `Good ${greeting()}.`;
  const pct = h.pack && h.pack.total ? Math.round((h.pack.done / h.pack.total) * 100) : 0;
  const capitalLabel = slug === "desolenator" ? "plant capital" : "capital";

  return (
    <>
      <TopBar crumbs={[]} placeholder={`Ask Captain about ${h.companyName}`} />
      <Page>
        <PageHeader
          eyebrow="Rypples Engine"
          title={title}
          lede={h.lede}
        >
          <p className="meta">
            {h.dateLabel}
            {!h.founderFirst && <> · {h.founderTitle}</>}
          </p>
        </PageHeader>

        <Section id="pack" title="Your board pack">
          <Tile className="flex flex-col gap-5">
            {h.pack ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">{h.pack.title}</h3>
                    <p className="text-[15px] font-medium text-ink">{h.pack.status}</p>
                  </div>
                  {h.pack.shared ? (
                    <ButtonLink href={`${base}/board-pack`}>View board pack</ButtonLink>
                  ) : (
                    <ButtonLink variant="primary" href={`${base}/board-pack`}>
                      Finish board pack
                    </ButtonLink>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div
                    className="h-[6px] w-full max-w-[420px] rounded-full bg-off"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={h.pack.total}
                    aria-valuenow={h.pack.done}
                    aria-label="Board pack sections ready"
                  >
                    <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                  </div>
                  <Meta>
                    {h.pack.done} of {h.pack.total} sections ready
                  </Meta>
                </div>
                <p className="max-w-[640px] text-[14px]">{h.pack.text}</p>
              </>
            ) : (
              <p className="text-[15px] text-ink">Your first board pack will be drafted before your first board.</p>
            )}
          </Tile>
        </Section>

        <Section id="constraint" title="What we're clearing this quarter">
          <Tile className="flex flex-col gap-5">
            {h.constraint ? (
              <>
                <div className="flex flex-col gap-2">
                  <p className="font-display text-[26px] font-medium leading-[1.15] tracking-[-0.02em] text-ink">{h.constraint.statement}</p>
                  <Meta>{h.constraint.domainLabel}</Meta>
                  {h.constraint.detail && <p className="max-w-[700px] text-[14px]">{h.constraint.detail}</p>}
                </div>
                <div className="flex flex-col gap-4">
                  {slug === "desolenator" && (
                    <div>
                      <TextLink href={`${base}/capital`}>Open plant capital →</TextLink>
                    </div>
                  )}
                  {slug !== "desolenator" && (
                    <div>
                      <TextLink href={`${base}/capital`}>Open {capitalLabel} →</TextLink>
                    </div>
                  )}
                  <DisputeForm
                    companyId={h.companyId}
                    companyName={h.companyName}
                    slug={slug}
                    founderLabel={h.founderLabel}
                    domains={h.domains}
                    disputedLabel={h.constraint.disputed?.domainLabel ?? null}
                  />
                </div>
              </>
            ) : (
              <EmptyState>Your board-level partner will confirm the constraint in your first 100 days.</EmptyState>
            )}
          </Tile>
        </Section>

        <Section
          id="ledger"
          title="What Rypples owes you"
          aside={
            <span className="meta">
              {h.ledger.length} commitments · {h.delivered} delivered
            </span>
          }
        >
          <Tile className="flex flex-col gap-4">
            {h.ledger.length === 0 ? (
              <EmptyState>Your commitments from Rypples will appear here once your plan is agreed.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Commitment</Th>
                    <Th>From</Th>
                    <Th>Due</Th>
                    <Th>Status</Th>
                    <Th>Your rating</Th>
                  </tr>
                </thead>
                <tbody>
                  {h.ledger.map((r) => (
                    <tr key={r.id} id={`ledger-${r.id}`}>
                      <Td className="text-ink">{r.title}</Td>
                      <Td label="From">{r.from}</Td>
                      <Td label="Due">
                        <Prov p={r.provenance}>{r.due}</Prov>
                      </Td>
                      <Td label="Status">
                        <StatusDot tone={r.status === "delivered" ? "lime" : r.status === "in_progress" ? "amber" : "neutral"} label={r.statusLabel} />
                      </Td>
                      <Td label="Your rating">
                        {r.status === "delivered" ? (
                          <RatingControl commitmentId={r.id} companyId={h.companyId} title={r.title} initial={r.rating} />
                        ) : (
                          <span className="text-ink-3">After delivery</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Meta>Everything Rypples has committed to. Rate it once it&rsquo;s delivered. Jerome sees your ratings.</Meta>
          </Tile>
        </Section>

        <div className="grid gap-8 xl:grid-cols-2">
          <Section id="network" title="From the Rypples network">
            <Tile>
              {h.lesson ? <LessonCard lesson={h.lesson} companyId={h.companyId} /> : <EmptyState>Nothing new from the network this week.</EmptyState>}
            </Tile>
          </Section>

          {h.circle && (
            <Section id="circle" title={h.circle.name}>
              <Tile className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-medium text-ink">{h.circle.theme}</p>
                  <Meta>
                    {h.circle.session} · <Illustrative>{h.circle.next}</Illustrative>
                  </Meta>
                </div>
                {h.circle.members.length > 0 && (
                  <p className="text-[14px]">
                    <span className="font-medium text-ink">With you: </span>
                    {h.circle.members.join(", ")}
                  </p>
                )}
                {h.circle.commitment && (
                  <p className="text-[14px]">
                    <span className="font-medium text-ink">Your commitment is {h.circle.commitment.label}: </span>
                    <Prov p={h.circle.commitment.provenance}>
                      {h.circle.commitment.text.charAt(0).toLowerCase() + h.circle.commitment.text.slice(1)}
                    </Prov>
                  </p>
                )}
              </Tile>
            </Section>
          )}
        </div>
      </Page>
    </>
  );
}
