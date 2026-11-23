import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { ExitedView, FullView, StandardView } from "@/components/rypples/company/Views";
import { getState } from "@/lib/data";
import { COMPANY_TAB_KEYS, getCompanyView, loadReviewedF2, type CompanyTab } from "@/lib/data/projections/company";
import { getSessionId } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getState(await getSessionId());
  const c = s.companies.find((x) => x.slug === slug && x.status !== "unannounced");
  return { title: c?.name ?? "Company" };
}

async function loadMarkets() {
  try {
    const { getMarkets } = await import("@/lib/geo");
    const m = getMarkets();
    return { markets: m.markets, pins: m.pins, datasets: m.datasets };
  } catch {
    return null;
  }
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const s = await getState(await getSessionId());
  const v = getCompanyView(s, slug);
  if (!v) notFound();

  const crumbs = [{ label: "Portfolio", href: "/os/portfolio" }, { label: v.head.name }];
  const placeholder = `Ask Captain about ${v.head.name}`;

  let body: React.ReactNode;
  if (v.kind === "full") {
    const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
    const wanted = (COMPANY_TAB_KEYS as readonly string[]).includes(raw ?? "") ? (raw as CompanyTab) : null;
    const tab = v.tabs.find((t) => t.key === wanted)?.key ?? v.tabs[0].key;
    const markets = tab === "market" ? await loadMarkets() : null;
    body = <FullView v={v} tab={tab} markets={markets} />;
  } else if (v.kind === "standard") {
    body = <StandardView v={v} f2={await loadReviewedF2(s, slug)} />;
  } else {
    body = <ExitedView v={v} />;
  }

  return (
    <>
      <TopBar crumbs={crumbs} placeholder={placeholder} />
      <Page>{body}</Page>
    </>
  );
}
