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
      homeHref="/os"
      nav={[
        { href: "/os", label: "Home", icon: "home", badge: shell.openDecisions, exact: true },
        { href: "/os/portfolio", label: "Portfolio", icon: "portfolio" },
        { href: "/os/playbook", label: "Playbook", icon: "book" },
        { href: "/os/growth-engine", label: "Growth Engine", icon: "engine" },
        { href: "/os/pipeline", label: "Pipeline", icon: "pipeline" },
        { href: "/os/reporting", label: "Reporting", icon: "report" },
      ]}
      boardSeats={shell.boardSeats}
      profile={{
        name: "Jerome Ternynck",
        title: "Co-founder & CEO",
        initials: "JT",
        photo: photoFor("jerome"),
        href: "/bridge/desolenator",
        switchLabel: "Open Rypples Bridge",
      }}
      captainScope={{ kind: "os" }}
    >
      {children}
    </AppShell>
  );
}
