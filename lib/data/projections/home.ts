import type { State } from "../state";
import { portfolioCounts, stuckByConstraint } from "@/lib/domain/portfolio-stats";
import { dayInFirst100, offsetLabel, numberWord, weekday, offsetDate } from "@/lib/scenario";

export function getHome(s: State) {
  const decisions = s.decisions.filter((d) => d.status === "open").sort((a, b) => a.sort - b.sort);
  const counts = portfolioCounts(s);
  const stuck = stuckByConstraint(s);
  const deso = s.companies.find((c) => c.id === "desolenator")!;
  const day = dayInFirst100(deso.round_closed_at ?? undefined);
  const lesson = s.lessons.find((l) => l.id === "wsense-strategic");
  const lessonMatches = s.lesson_matches.filter((m) => m.lesson_id === "wsense-strategic");
  const unsent = lessonMatches.filter((m) => m.status !== "sent").length;
  const boardDay = weekday(offsetDate(deso.next_board_offset ?? 3));
  const n = decisions.length;

  const parts: string[] = [];
  parts.push(`Desolenator is on day ${day} of its first 100 days with Rypples as anchor, its board meets on ${boardDay}`);
  let lessonClause = "";
  if (lesson && unsent > 0)
    lessonClause =
      lesson.status === "approved"
        ? `, and the lesson from WSense's exit is approved and ready to send to ${numberWord(unsent).toLowerCase()} ${unsent === 1 ? "company" : "companies"}`
        : `, and the lesson from WSense's exit is ready to send to ${numberWord(unsent).toLowerCase()} ${unsent === 1 ? "company" : "companies"}`;
  const lead =
    n === 0 ? "Nothing needs you this week." : `${numberWord(n)} ${n === 1 ? "thing needs" : "things need"} you this week.`;
  const lede = `${lead} ${parts[0]}${lessonClause}.`;

  // records Captain read for the brief (derived, not a fixed number)
  const records =
    s.decisions.length + s.agenda_items.length + s.companies.length + s.company_constraints.length + s.commitments.length + s.lessons.length;

  const backedCompanies = s.companies.filter((c) => c.status === "active" || c.status === "exited" || c.status === "unannounced");
  const dots = backedCompanies
    .map((c) => ({
      id: c.id,
      label: c.status === "unannounced" ? "Active, not yet announced" : c.status === "exited" ? `${c.name} (exit)` : c.name,
      kind: c.status === "exited" ? ("exit" as const) : c.status === "unannounced" ? ("unannounced" as const) : ("active" as const),
      added: c.session_added,
    }))
    .sort((a, b) => order(a.kind) - order(b.kind));

  return {
    lede,
    records,
    decisions,
    counts,
    stuck: stuck.filter((g) => ["operations", "commercial", "financing"].includes(g.domain) || g.count > 0).slice(0, 3),
    dots,
    agenda: s.agenda_items
      .slice()
      .sort((a, b) => a.at_offset - b.at_offset)
      .map((a) => ({ ...a, when: offsetLabel(a.at_offset) })),
    wsenseExit: s.companies.find((c) => c.id === "wsense")?.exit_note ?? null,
  };
}
const order = (k: string) => (k === "active" ? 0 : k === "unannounced" ? 1 : 2);
