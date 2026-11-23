import type { State } from "../state";
import type { Provenance } from "@/lib/domain/schemas";
import { isActivePublic } from "@/lib/domain/portfolio-stats";
import { offsetLabel } from "@/lib/scenario";

export const WSENSE_LESSON_ID = "wsense-strategic";

const domainLabel = (s: State, slug: string) => s.domains.find((d) => d.slug === slug)?.label ?? slug;

export type IntakeRow = {
  id: string;
  title: string;
  who: string;
  when: string;
  outcome: string;
  cta: "Review" | "Open";
  confidential: boolean;
  proposed: { id: string; title: string; domain: string } | null;
  actions: string[];
  reviewed: "approved" | "rejected" | null;
};

export type TimelineRow = {
  date: string;
  label: string;
  event: string;
  source: { href: string; label: string } | null;
  illustrative: boolean;
  note: string | null;
};

export type TravelRow = {
  companyId: string;
  slug: string;
  name: string;
  reason: string;
  reasonProvenance: Provenance;
  fit: "strong" | "possible";
  sent: boolean;
  verify: string | null;
};

export function getPlaybook(s: State) {
  const lesson = s.lessons.find((l) => l.id === WSENSE_LESSON_ID);
  if (!lesson) throw new Error("Lesson wsense-strategic is missing from the seed");
  const sourceById = new Map(s.sources.map((x) => [x.id, x]));

  // ── intake ────────────────────────────────────────────────────────────
  const sessions = [...s.intake_sessions].sort((a, b) => b.held_offset - a.held_offset);
  const proposedCount = sessions.filter((i) => i.proposed_lesson).length;
  const intake: IntakeRow[] = sessions.map((i) => ({
    id: i.id,
    title: i.title,
    who: i.who_label.split(" · ")[0],
    when: offsetLabel(i.held_offset),
    outcome: i.outcome,
    cta: i.cta,
    confidential: i.confidential,
    proposed: i.proposed_lesson
      ? { id: i.proposed_lesson.id, title: i.proposed_lesson.title, domain: domainLabel(s, i.proposed_lesson.domain_id) }
      : null,
    actions: i.actions,
    reviewed: s.extras.intakeReviewed[i.id] ?? null,
  }));
  const intakeCount = `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} · ${proposedCount} ${proposedCount === 1 ? "lesson" : "lessons"} proposed`;

  // ── lesson ────────────────────────────────────────────────────────────
  const timeline: TimelineRow[] = lesson.timeline.map((t) => {
    const src = t.source_id ? sourceById.get(t.source_id) : undefined;
    return {
      date: t.date,
      label: t.label,
      event: t.event,
      source: src ? { href: src.url, label: src.publisher } : null,
      illustrative: t.provenance === "illustrative" || !src,
      note: t.provenance === "illustrative" ? "Illustrative. A public source for this step has not been found yet." : null,
    };
  });
  const sourceIds = new Set(lesson.timeline.map((t) => t.source_id).filter((id): id is string => !!id && sourceById.has(id)));
  const approved = lesson.status === "approved";
  const statusLine = approved
    ? "Approved · in the Playbook"
    : `Drafted from ${sourceIds.size} public ${sourceIds.size === 1 ? "source" : "sources"} · waiting for your approval`;

  // ── replay ────────────────────────────────────────────────────────────
  const replay = s.replay_steps
    .filter((r) => r.lesson_id === lesson.id)
    .map((r) => {
      const src = r.source_id ? sourceById.get(r.source_id) : undefined;
      return {
        id: r.id,
        at: r.at,
        label: r.label,
        event: r.event,
        source: src ? { href: src.url, label: src.publisher } : null,
        illustrative: !src,
        read: r.platform_read,
      };
    });

  // ── who it travels to ─────────────────────────────────────────────────
  const sourceCompany = s.companies.find((c) => c.name === lesson.learned_in || c.id === lesson.learned_in.toLowerCase());
  const eligible = s.companies.filter((c) => isActivePublic(c) && c.id !== sourceCompany?.id && c.status !== "exited");
  const matches = s.lesson_matches.filter((m) => m.lesson_id === lesson.id);
  const rows: TravelRow[] = matches.map((m) => {
    const c = s.companies.find((c) => c.id === m.company_id);
    return {
      companyId: m.company_id,
      slug: c?.slug ?? m.company_id,
      name: c?.name ?? m.company_id,
      reason: m.reason,
      reasonProvenance: m.reason_provenance,
      fit: m.fit,
      sent: m.status === "sent",
      verify: m.verify_note,
    };
  });

  // ── library ───────────────────────────────────────────────────────────
  const library = s.lessons
    .filter((l) => l.in_library || (l.status === "approved" && l.id === lesson.id))
    .map((l) => {
      const sentNow = s.extras.sentLessons.filter((x) => x.lesson_id === l.id).length;
      const helpedNow = s.extras.usefulLessons.filter((x) => x.lesson_id === l.id).length;
      return {
        id: l.id,
        title: l.title,
        domain: domainLabel(s, l.domain_id),
        learnedIn: l.learned_in,
        sent: (l.sent ?? 0) + sentNow,
        helped: (l.helped ?? 0) + helpedNow,
      };
    });

  const wsenseDecisionOpen = s.decisions.some((d) => d.id === "dec-wsense-lesson" && d.status === "open");
  const names: Record<string, string> = Object.fromEntries(s.companies.map((c) => [c.id, c.name]));

  return {
    intake,
    intakeCount,
    lesson: {
      id: lesson.id,
      title: lesson.title,
      domain: domainLabel(s, lesson.domain_id),
      learnedIn: lesson.learned_in,
      play: lesson.play,
      timeline,
      approved,
      statusLine,
    },
    replay,
    travels: {
      lessonId: lesson.id,
      approved,
      matched: matches.length,
      eligible: eligible.length,
      rows,
      anySent: rows.some((r) => r.sent),
      runId: s.extras.lessonMatchesRunId[lesson.id] ?? null,
    },
    library,
    wsenseDecisionOpen,
    names,
  };
}
export type PlaybookView = ReturnType<typeof getPlaybook>;
