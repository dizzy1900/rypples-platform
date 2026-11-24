import { TopBar, Page } from "@/components/shell/TopBar";
import { Illustrative, PageHeader, StatBlock } from "@/components/ui";
import { PartnersCrm } from "@/components/rypples/partners/PartnersCrm";
import { getState } from "@/lib/data";
import { getOperatingPartners } from "@/lib/data/projections/partners";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Operating partners" };

export default async function OperatingPartnersPage({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  const { partner } = await searchParams;
  const view = getOperatingPartners(await getState(await getSessionId()));
  return (
    <>
      <TopBar crumbs={[{ label: "Operating partners" }]} placeholder="Ask Captain about operating partners" />
      <Page>
        <PageHeader
          eyebrow="Operating partners"
          title="Find, onboard and equip the people who help founders"
          lede="Board-level partners are external and work with one company's board each, where Rypples holds a seat. Experts and specialists work across the portfolio. Each record shows what the partner does, where they are in onboarding, the tools they use and the companies they work with."
        />
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <StatBlock value={view.stats.active} label="Active partners" />
          <StatBlock value={view.stats.inFunnel} label="Being found or onboarded" />
          <StatBlock value={<Illustrative>{`${view.capacity.pct}%`}</Illustrative>} label={view.capacity.line} />
          {view.tightest && <StatBlock value={<Illustrative>{`${view.tightest.pct}%`}</Illustrative>} label={`${view.tightest.role}, the tightest`} />}
        </div>
        <PartnersCrm view={view} initialPartner={partner ?? null} />
      </Page>
    </>
  );
}
