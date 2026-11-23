import { TopBar, Page } from "@/components/shell/TopBar";
import { PageHeader } from "@/components/ui";
import { UrlTabs } from "@/components/ui/client";
import { PartnersTab } from "@/components/rypples/engine/PartnersTab";
import { ProgramsTab } from "@/components/rypples/engine/ProgramsTab";
import { ReadinessTab } from "@/components/rypples/engine/ReadinessTab";
import { ScalersTab } from "@/components/rypples/engine/ScalersTab";
import { TalentTab } from "@/components/rypples/engine/TalentTab";
import { getState } from "@/lib/data";
import { ENGINE_TABS, getPartners, getPrograms, getReadiness, getScalers, getTalent, type EngineTab } from "@/lib/data/projections/engine";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Growth Engine" };

export default async function GrowthEnginePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab: EngineTab = ENGINE_TABS.some((t) => t.key === raw) ? (raw as EngineTab) : "programs";
  const s = await getState(await getSessionId());
  const scalers = tab === "scalers" ? getScalers(s) : null;
  return (
    <>
      <TopBar crumbs={[{ label: "Home", href: "/os" }, { label: "Growth Engine" }]} placeholder="Ask Captain about the Growth Engine" />
      <Page>
        <PageHeader
          eyebrow="Growth Engine"
          title="Operators, programs and know-how"
          lede="The programs Rypples runs, the people who deliver them, and whether founders say they work. Every Anchor term sheet includes a Growth Engine allocation, and this is where it is designed, staffed and delivered."
        />
        <UrlTabs tabs={ENGINE_TABS.map((t) => ({ key: t.key, label: t.label }))} current={tab} label="Growth Engine sections" />
        {tab === "programs" && <ProgramsTab view={getPrograms(s)} />}
        {tab === "partners" && <PartnersTab view={getPartners(s)} />}
        {tab === "talent" && <TalentTab view={getTalent(s)} />}
        {tab === "scalers" && scalers && <ScalersTab view={scalers} />}
        {tab === "readiness" && <ReadinessTab modules={getReadiness(s)} />}
      </Page>
    </>
  );
}
