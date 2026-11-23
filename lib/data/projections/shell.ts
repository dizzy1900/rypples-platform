import type { State } from "../state";
import { offsetLabel } from "@/lib/scenario";

export type ShellData = {
  openDecisions: number;
  boardSeats: { slug: string; name: string; nextBoard: string; added: boolean }[];
};

export function getOsShell(s: State): ShellData {
  return {
    openDecisions: s.decisions.filter((d) => d.status === "open").length,
    boardSeats: s.companies
      .filter((c) => c.board_seat && c.status === "active")
      .map((c) => {
        const next = s.board_meetings.find((b) => b.company_id === c.id && b.kind === "next");
        const nextBoard =
          next?.at_offset != null ? offsetLabel(next.at_offset) : c.next_board_offset != null ? offsetLabel(c.next_board_offset) : c.next_board_label ?? "";
        return { slug: c.slug, name: c.name, nextBoard, added: c.session_added };
      }),
  };
}

export type BridgeShellData = {
  slug: string;
  company: string;
  vertical: string | null;
  region: string | null;
  founder: { name: string; title: string; initials: string; photo: string | null };
};

export function getBridgeShell(s: State, slug: string): BridgeShellData | null {
  const c = s.companies.find((c) => c.slug === slug && c.anchor);
  if (!c) return null;
  const p = s.people.find((p) => p.id === c.ceo_person_id) ?? s.people.find((p) => p.company_id === c.id && p.kind === "founder");
  return {
    slug,
    company: c.name,
    vertical: c.vertical,
    region: c.region,
    founder: {
      name: p?.name ?? `CEO, ${c.name}`,
      title: p?.title ?? "CEO",
      initials: p?.initials ?? c.name.slice(0, 2).toUpperCase(),
      photo: p?.photo_path ?? null,
    },
  };
}
