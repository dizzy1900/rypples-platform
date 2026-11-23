import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { Schedule } from "@/components/rypples/Schedule";
import { getState } from "@/lib/data";
import { getSchedule } from "@/lib/data/projections/company";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Growth Engine schedule" };

export default async function OsSchedule({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getSchedule(await getState(await getSessionId()), slug);
  if (!s) notFound();
  return (
    <>
      <TopBar
        crumbs={[
          { label: "Portfolio", href: "/os/portfolio" },
          { label: s.company.name, href: `/os/companies/${slug}` },
          { label: "Growth Engine schedule" },
        ]}
        placeholder={`Ask Captain about ${s.company.name}`}
      />
      <Page>
        <Schedule s={s} backHref={`/os/companies/${slug}`} />
      </Page>
    </>
  );
}
