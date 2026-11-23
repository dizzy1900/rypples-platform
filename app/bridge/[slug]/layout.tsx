import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getState } from "@/lib/data";
import { getBridgeShell } from "@/lib/data/projections/shell";
import { getSessionId } from "@/lib/session";
import { photoFor } from "@/lib/data/peoplePhotos";

export const metadata: Metadata = { title: { default: "Rypples Bridge", template: "%s · Rypples Bridge" } };
export const dynamic = "force-dynamic";

export default async function BridgeLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = await getState(await getSessionId());
  const shell = getBridgeShell(state, slug);
  if (!shell) notFound();
  const base = `/bridge/${slug}`;
  const personId = state.companies.find((c) => c.slug === slug)?.ceo_person_id ?? "";
  return (
    <AppShell
      product="Bridge"
      homeHref={base}
      nav={[
        { href: base, label: "Home", icon: "home", exact: true },
        { href: `${base}/board-pack`, label: "Board pack", icon: "doc" },
        { href: `${base}/capital`, label: slug === "desolenator" ? "Plant capital" : "Capital", icon: "capital" },
        { href: `${base}/how-rypples-works`, label: "How Rypples works", icon: "handshake" },
      ]}
      companyBlock={{ name: shell.company, meta: [shell.vertical, shell.region].filter(Boolean).join(" · ") }}
      profile={{
        name: shell.founder.name,
        title: shell.founder.title,
        initials: shell.founder.initials,
        photo: personId ? photoFor(personId) : null,
        href: "/os",
        switchLabel: "Open Rypples OS",
      }}
      captainScope={{ kind: "bridge", slug, companyName: shell.company }}
    >
      {children}
    </AppShell>
  );
}
