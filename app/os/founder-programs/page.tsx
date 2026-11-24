import { TopBar, Page } from "@/components/shell/TopBar";
import { Illustrative, PageHeader, Tile } from "@/components/ui";
import { UrlTabs } from "@/components/ui/client";
import { ReadinessGrid } from "@/components/rypples/programs/ReadinessGrid";
import { ScalersTab } from "@/components/rypples/programs/ScalersTab";
import { getState } from "@/lib/data";
import { getCeoDevelopment, getReadinessGrid, getScalers, PROGRAM_TABS, type ProgramTab } from "@/lib/data/projections/founder-programs";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Founder programs" };

export default async function FounderProgramsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab: ProgramTab = PROGRAM_TABS.some((t) => t.key === raw) ? (raw as ProgramTab) : "readiness";
  const s = await getState(await getSessionId());
  const scalers = tab === "scalers" ? getScalers(s) : null;
  const ceo = tab === "scalers" ? getCeoDevelopment(s) : [];
  return (
    <>
      <TopBar crumbs={[{ label: "Founder programs" }]} placeholder="Ask Captain about founder programs" />
      <Page>
        <PageHeader
          eyebrow="Founder programs"
          title="Growth Readiness for companies, Ocean Scalers for CEOs"
          lede="How Rypples runs its founder programs. Growth Readiness is per company, recommended by the diagnostic. Ocean Scalers puts CEOs at the same stage in a peer circle, alongside their own development."
        />
        <UrlTabs tabs={PROGRAM_TABS.map((t) => ({ key: t.key, label: t.label }))} current={tab} label="Founder programs" />
        {tab === "readiness" && <ReadinessGrid view={getReadinessGrid(s)} />}
        {tab === "scalers" && (
          <div className="flex flex-col gap-8">
            {scalers && <ScalersTab view={scalers} />}
            {ceo.length > 0 && (
              <section className="flex flex-col gap-4" aria-labelledby="ceo-h">
                <h2 id="ceo-h" className="h2">
                  CEO development
                </h2>
                <Tile className="flex flex-col gap-3">
                  <p className="text-[15px] text-ink">Every Anchor CEO gets a day-100 360, a matched coach and a seat in an Ocean Scalers circle.</p>
                  {ceo.map((c) => (
                    <p key={c.id} className="text-[14px] text-ink-2">
                      {c.who}, {c.company}: <Illustrative>{c.note}</Illustrative>
                    </p>
                  ))}
                </Tile>
              </section>
            )}
          </div>
        )}
      </Page>
    </>
  );
}
