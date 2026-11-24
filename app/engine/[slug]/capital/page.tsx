import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { EmptyState, PageHeader, Prov, Section, SourceChip, TextLink, Tile } from "@/components/ui";
import { InstrumentList } from "@/components/rypples/bridge/InstrumentList";
import { MarketsPanel } from "@/components/rypples/bridge/MarketsPanel";
import { PilotTracker } from "@/components/rypples/bridge/PilotTracker";
import { getState } from "@/lib/data";
import { getCapitalView } from "@/lib/data/projections/bridge";
import { getSessionId } from "@/lib/session";
import { getMarkets } from "@/lib/geo";

export const metadata = { title: "Plant capital" };
export const dynamic = "force-dynamic";

export default async function CapitalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getState(await getSessionId());
  const v = getCapitalView(s, slug);
  if (!v) notFound();
  const geo = v.hasCapital ? getMarkets() : null;
  const empty = !v.hasCapital && v.pilots.length === 0 && v.instruments.length === 0;

  return (
    <>
      <TopBar crumbs={[{ label: v.hasCapital ? "Plant capital" : "Capital" }]} placeholder={`Ask Captain about ${v.companyName}`} />
      <Page>
        <PageHeader
          eyebrow={v.hasCapital ? "Plant capital" : "Capital"}
          title={v.hasCapital ? "Plant SPV #1, and the buyers behind it" : "Capital and customers"}
          lede="Two halves of scaling water-as-a-service: capital for each plant, and buyers who commit to more than one."
        />

        {empty && (
          <Section>
            <Tile>
              <EmptyState>Nothing here yet. Your capital stack and buyers appear once they are part of your plan with your board-level partner.</EmptyState>
            </Tile>
          </Section>
        )}

        {v.hasCapital && (
          <Section
            id="stack"
            title="Capital stack"
            meta="Most junior at the top"
            aside={v.layerSource ? <SourceChip href={v.layerSource.url} label={v.layerSource.label} /> : undefined}
          >
            <Tile className="py-2">
              <ol>
                {v.layers.map((l, i) => (
                  <li key={l.id} className="grid grid-cols-[28px_1fr] gap-3 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[28px_1fr_auto] sm:items-center sm:gap-5">
                    <span className="font-display text-[18px] text-ink-3" aria-hidden>
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium text-ink">{l.name}</span>
                      <span className="text-[13px] text-ink-3">
                        <Prov p={l.provenance}>{l.who}</Prov>
                      </span>
                    </div>
                    <span className="max-sm:col-start-2 text-[13px] text-ink-2">
                      {l.ledgerHref ? (
                        <TextLink href={l.ledgerHref}>{l.status}</TextLink>
                      ) : (
                        <Prov p={l.provenance}>{l.status}</Prov>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </Tile>
          </Section>
        )}

        {v.instruments.length > 0 && (
          <Section id="instruments" title="Where the money could come from">
            <Tile>
              <InstrumentList companyId={v.companyId} instruments={v.instruments} />
            </Tile>
          </Section>
        )}

        {geo && (
          <Section id="markets" title="Where the next plants go">
            <Tile>
              <MarketsPanel markets={geo.markets} pins={geo.pins} datasets={geo.datasets} />
            </Tile>
          </Section>
        )}

        {v.pilots.length > 0 && (
          <Section id="pilots" title="Pilot to contract">
            <Tile>
              <PilotTracker companyId={v.companyId} pilots={v.pilots} stages={v.stages} />
            </Tile>
          </Section>
        )}
      </Page>
    </>
  );
}
