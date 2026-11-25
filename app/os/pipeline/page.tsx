import { TopBar, Page } from "@/components/shell/TopBar";
import { PageHeader } from "@/components/ui";
import { PipelineClient } from "@/components/rypples/pipeline/PipelineClient";
import { getState } from "@/lib/data";
import { getPipeline } from "@/lib/data/projections/pipeline";
import { getSessionId } from "@/lib/session";
import { fullDate, scenarioDate } from "@/lib/scenario";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ deal?: string | string[] }> }) {
  const sp = await searchParams;
  const s = await getState(await getSessionId());
  const view = getPipeline(s);
  const raw = Array.isArray(sp.deal) ? sp.deal[0] : sp.deal;
  const initial = view.deals.some((d) => d.id === raw) ? (raw as string) : null;
  return (
    <>
      <TopBar crumbs={[{ label: "Pipeline" }]} placeholder="Ask Captain about the pipeline" />
      <Page>
        <PageHeader
          eyebrow="Pipeline"
          title="Anchor-stage deals"
          lede="Each deal is diligenced with the same diagnostic the portfolio runs on, so the plan exists the day Rypples leads the round."
        />
        <PipelineClient view={view} initialDealId={initial} closeDate={fullDate(scenarioDate())} />
      </Page>
    </>
  );
}
