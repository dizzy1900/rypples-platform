/**
 * Bridge view models (docs/06-screens.md S11–S14), scoped to one company.
 * Founder scope: only this company's records, lessons sent to it, programs, and public portfolio facts.
 * Never other companies' constraints, ratings, diagnostics or Rypples OS internals (docs/03-architecture.md §6).
 */
import type { State } from "../state";
import type { BoardPackSection, Company, Provenance } from "@/lib/domain/schemas";
import { allocationUsed, boardPartnerFor } from "@/lib/domain/capacity";
import { dayInFirst100, fullDate, longDay, numberWord, offsetDate, parseIso, weekday } from "@/lib/scenario";

// ── Shared ──────────────────────────────────────────────────────────────
export const PILOT_STAGES = ["Pilot", "Terms", "Contract", "Multi-site"] as const;

export type BridgeCtx = { company: Company; founderName: string | null; founderFirst: string | null; founderLabel: string };

/** The anchored company behind /bridge/[slug], or null (not an anchor → 404). */
export function getBridgeCtx(s: State, slug: string): BridgeCtx | null {
  const company = s.companies.find((c) => c.slug === slug && c.anchor);
  if (!company) return null;
  const p = s.people.find((p) => p.id === company.ceo_person_id) ?? s.people.find((p) => p.company_id === company.id && p.kind === "founder");
  const name = p?.name ?? null;
  const first = name ? name.split(" ")[0] : null;
  return { company, founderName: name, founderFirst: first, founderLabel: first ?? `${company.name}'s CEO` };
}

const lowerFirst = (t: string) => (t ? t[0].toLowerCase() + t.slice(1) : t);
const sourceUrl = (s: State, id: string | null) => (id ? s.sources.find((x) => x.id === id) ?? null : null);

// ── S11 Bridge home ─────────────────────────────────────────────────────
export type LedgerRow = {
  id: string;
  title: string;
  from: string;
  due: string;
  status: Commitment_["status"];
  statusLabel: string;
  rating: number | null;
  provenance: Provenance;
};
type Commitment_ = State["commitments"][number];

const STATUS_LABEL: Record<Commitment_["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  open: "Open",
  delivered: "Delivered",
};

const NEED_PHRASE: Record<BoardPackSection["key"], string> = {
  letter: "write the CEO letter",
  pilots: "confirm pilot status",
  ops: "add plant uptime",
  asks: "review the asks",
  fin: "check the financials",
  plan: "review plan progress",
};

export function getBridgeHome(s: State, slug: string) {
  const ctx = getBridgeCtx(s, slug);
  if (!ctx) return null;
  const { company } = ctx;

  // board pack tile
  const pack = s.board_packs.find((b) => b.company_id === company.id) ?? null;
  const sections = pack ? s.board_pack_sections.filter((x) => x.pack_id === pack.id).sort((a, b) => a.sort - b.sort) : [];
  const shared = !!pack && (pack.status === "shared" || s.extras.sharedPacks.includes(pack.id));
  const needs = sections.filter((x) => x.state === "needs");
  const done = sections.length - needs.length;
  const needsPhrases = needs.map((x) => NEED_PHRASE[x.key]);
  const pulled = sections.some((x) => x.key === "fin" && x.state === "ready");
  const phrase =
    needsPhrases.length <= 1
      ? needsPhrases[0] ?? ""
      : `${needsPhrases.slice(0, -1).join(", ")} and ${needsPhrases[needsPhrases.length - 1]}`;
  const packTile = pack
    ? {
        id: pack.id,
        title: `Board pack · ${longDay(offsetDate(pack.meeting_offset))}`,
        shared,
        status: shared
          ? "Shared with your board"
          : needs.length > 0
            ? `Drafted. ${numberWord(needs.length)} ${needs.length === 1 ? "section needs" : "sections need"} you.`
            : "Ready to share.",
        text: shared
          ? "Your board can see the pack. Rypples reads it to update the diagnostic and sends it back to you."
          : needs.length > 0
            ? `${pulled ? "Financials and KPIs are pulled in. " : ""}You still need to ${phrase}.`
            : "Every section is ready. Share it with your board when you are.",
        done,
        total: sections.length,
      }
    : null;

  // lede
  const nextMeeting = s.board_meetings.find((b) => b.company_id === company.id && b.kind === "next");
  const boardOffset = pack?.meeting_offset ?? nextMeeting?.at_offset ?? company.next_board_offset ?? null;
  const boardDay = boardOffset != null ? weekday(offsetDate(boardOffset)) : null;
  const commitmentsAll = s.commitments.filter((c) => c.company_id === company.id).sort((a, b) => a.sort - b.sort);
  const dueTitles = new Set<string>();
  for (const c of commitmentsAll) if (c.status !== "delivered" && c.due_offset != null && c.due_offset >= 0 && c.due_offset <= 6) dueTitles.add(c.title);
  for (const m of s.missions) if (m.company_id === company.id && m.due_offset >= 0 && m.due_offset <= 6) dueTitles.add(m.title);
  const dueCount = dueTitles.size;
  const dueClause =
    dueCount === 0
      ? "Nothing Rypples promised you is due this week."
      : `${numberWord(dueCount)} ${dueCount === 1 ? "thing" : "things"} Rypples promised you ${dueCount === 1 ? "is" : "are"} due this week.`;
  const boardClause = boardDay
    ? !pack
      ? `Your board meets on ${boardDay}.`
      : shared
        ? `Your board meets on ${boardDay} and the pack is shared.`
        : needs.length === 0
          ? `Your board meets on ${boardDay} and the pack is ready to share.`
          : `Your board meets on ${boardDay} and the pack is already drafted from last quarter's numbers.`
    : "";
  const lede = [boardClause, dueClause].filter(Boolean).join(" ");

  // constraint
  const constraint = s.company_constraints.find((c) => c.company_id === company.id && !c.cleared_at) ?? null;
  const diag =
    s.diagnostics.filter((d) => d.company_id === company.id && d.binding_detail).sort((a, b) => (a.status === "confirmed" ? -1 : 0) - (b.status === "confirmed" ? -1 : 0))[0] ?? null;
  const domainLabel = (id: string) => s.domains.find((d) => d.id === id)?.label ?? id;
  const dispute = s.extras.disputes.filter((d) => d.company_id === company.id).slice(-1)[0] ?? null;
  const constraintView = constraint
    ? {
        statement: constraint.statement,
        domain: constraint.domain_id,
        domainLabel: domainLabel(constraint.domain_id),
        detail: diag?.binding_detail ?? null,
        provisional: constraint.provisional,
        disputed: dispute ? { domainLabel: domainLabel(dispute.domain_id) } : null,
      }
    : null;
  const domains = s.domains.slice().sort((a, b) => a.sort - b.sort).map((d) => ({ id: d.id, label: d.label }));

  // ledger
  const ledger: LedgerRow[] = commitmentsAll.map((c) => ({
    id: c.id,
    title: c.title,
    from: c.from_label,
    due: c.due_label,
    status: c.status,
    statusLabel: STATUS_LABEL[c.status],
    rating: c.rating,
    provenance: c.provenance,
  }));
  const delivered = ledger.filter((r) => r.status === "delivered").length;

  // lesson from the network: only lessons sent to this company in this session
  const sent = s.extras.sentLessons.filter((x) => x.company_id === company.id).slice(-1)[0] ?? null;
  const lessonRow = sent ? s.lessons.find((l) => l.id === sent.lesson_id) ?? null : null;
  const match = sent ? s.lesson_matches.find((m) => m.lesson_id === sent.lesson_id && m.company_id === company.id) ?? null : null;
  const lesson = lessonRow
    ? {
        id: lessonRow.id,
        title: lessonRow.title,
        learnedIn: lessonRow.learned_in,
        domainLabel: domainLabel(lessonRow.domain_id),
        why: match?.reason ?? null,
        whyProvenance: match?.reason_provenance ?? ("scenario" as Provenance),
        play: lessonRow.play,
        timeline: lessonRow.timeline.map((t) => ({
          date: t.date,
          event: t.event,
          provenance: t.provenance,
          source: (() => {
            const src = sourceUrl(s, t.source_id);
            return src ? { url: src.url, label: src.publisher || src.title } : null;
          })(),
        })),
        useful: s.extras.usefulLessons.some((u) => u.lesson_id === lessonRow.id && u.company_id === company.id),
      }
    : null;

  // circle (themes only; members are public portfolio facts)
  const circleRow = s.circles.find((c) => c.members.includes(company.id)) ?? null;
  const mine = circleRow ? s.circle_commitments.find((c) => c.circle_id === circleRow.id && c.company_id === company.id) ?? null : null;
  const circle = circleRow
    ? {
        name: circleRow.name,
        theme: circleRow.theme,
        session: `Session ${circleRow.session_n} of ${circleRow.of_n}`,
        next: circleRow.next_label,
        members: circleRow.members
          .filter((id) => id !== company.id)
          .map((id) => s.companies.find((c) => c.id === id))
          .filter((c): c is Company => !!c && c.public)
          .map((c) => c.name),
        commitment: mine
          ? {
              text: mine.text,
              status: mine.status,
              label: mine.status === "done" ? "done" : mine.status === "at_risk" ? "at risk" : "open",
              provenance: mine.provenance,
            }
          : null,
      }
    : null;

  return {
    slug,
    companyId: company.id,
    companyName: company.name,
    founderFirst: ctx.founderFirst,
    founderLabel: ctx.founderLabel,
    founderTitle: s.people.find((p) => p.id === company.ceo_person_id)?.title ?? `CEO, ${company.name}`,
    dateLabel: longDay(offsetDate(0)),
    lede,
    pack: packTile,
    constraint: constraintView,
    domains,
    ledger,
    delivered,
    lesson,
    circle,
  };
}
export type BridgeHome = NonNullable<ReturnType<typeof getBridgeHome>>;

// ── S12 Board pack ──────────────────────────────────────────────────────
export type PackSectionView = {
  key: BoardPackSection["key"];
  name: string;
  state: BoardPackSection["state"];
  stateLabel: string;
  kicker: string;
  title: string;
  sourceNote: string;
  paragraphs: string[];
  rows: { label: string; value: string; note: string | null }[];
  needs: boolean;
  needText: string | null;
  needCta: string | null;
  /** markdown the founder saved (or Captain drafted) for this section */
  content: string | null;
  founderEntered: boolean;
};

function relativeSaved(at: string | null): string {
  if (!at) return "Saved this morning";
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return "Saved this morning";
  if (mins < 1) return "Saved just now";
  if (mins < 60) return `Saved ${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Saved ${h} ${h === 1 ? "hour" : "hours"} ago`;
  return "Saved earlier";
}

export function getBoardPackView(s: State, slug: string) {
  const ctx = getBridgeCtx(s, slug);
  if (!ctx) return null;
  const { company } = ctx;
  const pack = s.board_packs.find((b) => b.company_id === company.id) ?? null;
  const base = { slug, companyId: company.id, companyName: company.name };
  if (!pack) return { ...base, pack: null as null };

  const shared = pack.status === "shared" || s.extras.sharedPacks.includes(pack.id);
  const pilots = s.pilots.filter((p) => p.company_id === company.id);
  const ops = s.extras.opsEntries[pack.id] ?? [];

  const sections: PackSectionView[] = s.board_pack_sections
    .filter((x) => x.pack_id === pack.id)
    .sort((a, b) => a.sort - b.sort)
    .map((x) => {
      const content = s.extras.sectionContent[`${pack.id}:${x.key}`] ?? null;
      let rows = x.rows;
      let paragraphs = x.paragraphs;
      let founderEntered = false;
      if (x.key === "pilots" && pilots.length) {
        rows = pilots.map((p) => {
          const confirmed = s.extras.pilotConfirmed[p.id];
          return {
            label: p.name.replace(/ \(ADQ\)$/, ""),
            value: confirmed != null ? `${confirmed > 0 ? PILOT_STAGES[confirmed - 1] : "Not started"} · confirmed` : p.board_label,
            note: null,
          };
        });
      }
      if (x.key === "ops" && ops.length) {
        founderEntered = true;
        paragraphs = [];
        rows = ops.map((o) => ({
          label: o.site,
          value: `${o.uptime_pct}% uptime · ${o.output_m3_day.toLocaleString("en-GB")} m³/day`,
          note: "Founder-entered",
        }));
      }
      return {
        key: x.key,
        name: x.name,
        state: x.state,
        stateLabel: x.state_label,
        kicker: x.kicker,
        title: x.title,
        sourceNote: founderEntered ? "Founder-entered" : x.source_note,
        paragraphs,
        rows,
        needs: x.state === "needs",
        needText: x.state === "needs" ? x.need_text : null,
        needCta: x.need_cta,
        content,
        founderEntered,
      };
    });

  const lastSave = s.events
    .filter((e) => e.type.startsWith("board_pack.") && (e.payload as { pack_id?: string }).pack_id === pack.id)
    .map((e) => e.at)
    .sort()
    .pop();

  const blockers = sections.filter((x) => x.needs).map((x) => x.name);
  return {
    ...base,
    pack: {
      id: pack.id,
      quarter: pack.quarter,
      quarterShort: pack.quarter.split(" ")[0],
      meetingLabel: longDay(offsetDate(pack.meeting_offset)),
      shared,
      statements: pack.share_statements,
      saved: relativeSaved(lastSave ?? null),
    },
    sections,
    blockers,
    pilots: pilots.map((p) => ({ id: p.id, name: p.name, stage: s.extras.pilotConfirmed[p.id] ?? p.stage })),
    stages: [...PILOT_STAGES],
  };
}

// ── S13 Plant capital and customers ─────────────────────────────────────
export function getCapitalView(s: State, slug: string) {
  const ctx = getBridgeCtx(s, slug);
  if (!ctx) return null;
  const { company } = ctx;
  const src = (id: string | null) => {
    const x = sourceUrl(s, id);
    return x ? { url: x.url, label: x.title } : null;
  };
  const layers = s.capital_layers
    .filter((l) => l.company_id === company.id)
    .sort((a, b) => a.sort - b.sort)
    .map((l) => ({
      id: l.id,
      name: l.name,
      who: l.who,
      status: l.status,
      provenance: l.provenance,
      ledgerHref: l.ledger_commitment_id ? `/bridge/${slug}#ledger` : null,
    }));
  const instruments = s.instruments
    .filter((i) => i.company_id === company.id)
    .map((i) => ({ id: i.id, name: i.name, why: i.why, shortlisted: i.shortlisted, provenance: i.provenance }));
  const pilots = s.pilots
    .filter((p) => p.company_id === company.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      note: p.note,
      stage: p.stage,
      source: src(p.source_id),
      provenance: p.provenance,
    }));
  return {
    slug,
    companyId: company.id,
    companyName: company.name,
    hasCapital: layers.length > 0,
    layers,
    layerSource: layers.length ? src("src_republic") : null,
    instruments,
    pilots,
    stages: [...PILOT_STAGES],
  };
}
export type CapitalView = NonNullable<ReturnType<typeof getCapitalView>>;

// ── S14 How Rypples works with you ──────────────────────────────────────
export type ProgramCardView = {
  id: string;
  name: string;
  domainLabel: string;
  weeks: number;
  outcome: string;
  status: "running" | "done" | "proposed" | "requested" | "none";
};

export function getHowItWorks(s: State, slug: string) {
  const ctx = getBridgeCtx(s, slug);
  if (!ctx) return null;
  const { company } = ctx;
  const alloc = s.allocations.find((a) => a.company_id === company.id) ?? null;
  const used = allocationUsed(s.enrolments, company.id);
  const programsTotal = alloc?.programs_total ?? 3;
  const hoursTotal = alloc?.hours_total ?? 400;
  const partner = boardPartnerFor(s.operators, company.vertical);
  const stages = s.lifecycle_stages.filter((l) => l.company_id === company.id);
  const order = ["day0", "first100", "quarterly", "strategic"];
  const day = company.round_closed_at ? dayInFirst100(company.round_closed_at) : null;
  const domainLabel = (id: string) => s.domains.find((d) => d.id === id)?.label ?? id;

  const programs: ProgramCardView[] = s.programs.map((p) => {
    const en = s.enrolments.find((e) => e.company_id === company.id && e.program_id === p.id);
    return {
      id: p.id,
      name: p.name,
      domainLabel: domainLabel(p.domain_id),
      weeks: p.length_weeks,
      outcome: p.outcome,
      status: en ? en.status : "none",
    };
  });

  return {
    slug,
    companyId: company.id,
    companyName: company.name,
    dayLine: day != null && company.round_closed_at ? `You're on day ${day} of 100 · Round closed ${fullDate(parseIso(company.round_closed_at))}` : null,
    stages: stages
      .slice()
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((l) => ({
        key: l.key,
        label: l.label,
        when: l.when,
        status: l.status,
        note: l.founder_note ?? l.note,
        provenance: l.provenance,
      })),
    allocation: {
      programsUsed: used.programs,
      programsTotal,
      hoursUsed: used.hours,
      hoursTotal,
      requestedHours: used.requestedHours,
      partnerFocus: partner ? lowerFirst(partner.focus) : null,
      provenance: (alloc?.provenance ?? "illustrative") as Provenance,
    },
    promises: s.promises,
    programs,
    scheduleHref: `/bridge/${slug}/schedule`,
  };
}
export type HowItWorks = NonNullable<ReturnType<typeof getHowItWorks>>;
