import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { getState } from "@/lib/data";
import { getOsShell } from "@/lib/data/projections/shell";
import { getSessionId } from "@/lib/session";
import { photoFor } from "@/lib/data/peoplePhotos";

export const metadata: Metadata = { title: { default: "Rypples OS", template: "%s · Rypples OS" } };
export const dynamic = "force-dynamic";

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const state = await getState(await getSessionId());
  const shell = getOsShell(state);
  return (
    <AppShell
      product="OS"
      homeHref="/"
      nav={[
        { href: "/os", label: "Home", icon: "home", badge: shell.openDecisions, exact: true },
        { href: "/os/portfolio", label: "Portfolio", icon: "portfolio" },
        { href: "/os/playbook", label: "Playbook", icon: "book" },
        { href: "/os/operating-partners", label: "Operating partners", icon: "handshake" },
        { href: "/os/founder-programs", label: "Founder programs", icon: "engine" },
        { href: "/os/pipeline", label: "Pipeline", icon: "pipeline" },
        { href: "/os/investor-relations", label: "Investor relations", icon: "report" },
      ]}
      boardSeats={shell.boardSeats}
      profile={{
        name: "Jerome Ternynck",
        title: "Co-founder",
        initials: "JT",
        photo: photoFor("jerome"),
        href: "/engine/desolenator",
        switchLabel: "Open Rypples Engine",
      }}
      captainScope={{ kind: "os" }}
    >
      {children}
    </AppShell>
  );
}
