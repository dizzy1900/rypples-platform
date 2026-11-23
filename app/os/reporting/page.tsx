import { TopBar, Page } from "@/components/shell/TopBar";
import { PageHeader } from "@/components/ui";
import { UrlTabs } from "@/components/ui/client";
import { AccelerationTab } from "@/components/rypples/reporting/AccelerationTab";
import { ImpactTab } from "@/components/rypples/reporting/ImpactTab";
import { PathsTab } from "@/components/rypples/reporting/PathsTab";
import { ShareholderUpdate } from "@/components/rypples/reporting/ShareholderUpdate";
import { getState } from "@/lib/data";
import { getAcceleration, getImpact, getPaths, getUpdate, REPORTING_TABS, type ReportingTab } from "@/lib/data/projections/reporting";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Reporting" };

export default async function ReportingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab: ReportingTab = REPORTING_TABS.some((t) => t.key === raw) ? (raw as ReportingTab) : "update";
  const s = await getState(await getSessionId());
  return (
    <>
      <TopBar crumbs={[{ label: "Home", href: "/os" }, { label: "Reporting" }]} placeholder="Ask Captain about reporting" />
      <Page>
        <PageHeader
          eyebrow="Reporting"
          title="What shareholders see"
          lede="The shareholder update, impact across the portfolio, and the strategic path for each company. Drafted from approved records only, so every figure traces back."
        />
        <UrlTabs tabs={REPORTING_TABS.map((t) => ({ key: t.key, label: t.label }))} current={tab} label="Reporting sections" />
        {tab === "update" && <ShareholderUpdate view={getUpdate(s)} />}
        {tab === "impact" && <ImpactTab view={getImpact(s)} />}
        {tab === "paths" && <PathsTab view={getPaths(s)} />}
        {tab === "acceleration" && <AccelerationTab view={getAcceleration(s)} />}
      </Page>
    </>
  );
}
