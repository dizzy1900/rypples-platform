import { TopBar, Page } from "@/components/shell/TopBar";
import { PageHeader } from "@/components/ui";
import { AnyCompanyInput } from "@/components/rypples/diagnostic/AnyCompanyInput";
import { getState } from "@/lib/data";
import { exampleCompanies } from "@/lib/data/projections/diagnostic";
import { f2Availability, recentRuns } from "@/lib/ai/runs";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Try it on any ocean company" };

export default async function NewDiagnosticPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const s = await getState(await getSessionId());
  const [recent, avail] = await Promise.all([recentRuns(6), f2Availability()]);
  return (
    <>
      <TopBar crumbs={[{ label: "Home", href: "/os" }, { label: "Diagnostic" }]} placeholder="Ask Captain about the portfolio" />
      <Page>
        <PageHeader
          eyebrow="Diagnostic"
          title="Try it on any ocean company"
          lede="Name a company or paste its website. Captain reads what's public, scores the eight domains with a source for every score, and proposes where Rypples would help first. It says so when the public record is too thin."
        />
        <AnyCompanyInput initialQuery={q} mode={avail.mode} recent={recent} examples={exampleCompanies(s)} />
      </Page>
    </>
  );
}
