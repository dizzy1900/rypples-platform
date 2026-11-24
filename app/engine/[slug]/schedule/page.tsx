import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { Schedule } from "@/components/rypples/Schedule";
import { getState } from "@/lib/data";
import { getSchedule } from "@/lib/data/projections/company";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Growth Engine schedule" };

export default async function EngineSchedule({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getSchedule(await getState(await getSessionId()), slug);
  if (!s) notFound();
  return (
    <>
      <TopBar
        crumbs={[{ label: "Growth Engine schedule" }]}
        placeholder={`Ask Captain about ${s.company.name}`}
      />
      <Page>
        <Schedule s={s} backHref={`/engine/${slug}`} backLabel="Back to Rypples Engine" />
      </Page>
    </>
  );
}
