import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { EmptyState, PageHeader } from "@/components/ui";
import { PackDiagnostic } from "@/components/rypples/diagnostic/PackDiagnostic";
import { getState } from "@/lib/data";
import { getPackView } from "@/lib/data/projections/diagnostic";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Diagnostic" };

export default async function PackDiagnosticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getState(await getSessionId());
  const v = getPackView(s, slug);
  if (!v) notFound();
  const name = v.company.name;
  return (
    <>
      <TopBar
        crumbs={[
          { label: "Portfolio", href: "/os/portfolio" },
          { label: name, href: `/os/companies/${v.company.slug}` },
          { label: "Diagnostic" },
        ]}
        placeholder={`Ask Captain about ${name}`}
      />
      <Page>
        <PageHeader
          eyebrow="Diagnostic"
          title={`${name}, read end to end`}
          lede={
            v.docs.length
              ? `The agent reads the pack, pulls out evidence and scores eight Growth Engine domains, with a citation for every score. Here the pack is ${name}'s public record. In use, it's the quarterly board pack.`
              : undefined
          }
        />
        {v.docs.length ? (
          <PackDiagnostic company={v.company} docs={v.docs} proposed={v.proposed} domains={v.domains} sourceDates={v.sourceDates} />
        ) : (
          <EmptyState>
            No source pack is connected for {name} yet. In use, the quarterly board pack arrives here from the founder&rsquo;s Bridge.
          </EmptyState>
        )}
      </Page>
    </>
  );
}
