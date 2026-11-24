/**
 * Resolve a shareholder-update reference (F6) to a value READ FROM THE RECORD in state.
 * The model never supplies a figure: it names a record, and this file reads it.
 */
import type { State } from "../state";
import type { Provenance } from "@/lib/domain/schemas";
import { portfolioCounts } from "@/lib/domain/portfolio-stats";
import { dayInFirst100, fullDate, parseIso } from "@/lib/scenario";

export type RefInput = { type: string; id: string; field: string };
export type ResolvedRef = {
  value: string;
  provenance: Provenance;
  /** record type + record, e.g. "Portfolio statistic · Companies backed" */
  label: string;
  href: string | null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "about €600m" from the Jul 2026 timeline entry of the WSense lesson (public). */
export function exitPackage(s: State): string | null {
  const lesson = s.lessons.find((l) => l.id === "wsense-strategic");
  for (const t of lesson?.timeline ?? []) {
    if (t.provenance !== "public") continue;
    const m = t.event.match(/about\s+€\s?\d[\d,.]*\s?(?:m|bn|million|billion)\b/i);
    if (m) return m[0].replace(/\s+/g, " ");
  }
  return null;
}

export function programsRunning(s: State): number {
  return s.enrolments.filter((e) => e.status === "running").length;
}

export function lessonsSent(s: State): number {
  return s.lessons.reduce((n, l) => n + (l.sent ?? 0), 0) + s.extras.sentLessons.length;
}

export function impactReporting(s: State): { reported: number; total: number } {
  return { reported: s.impact_kpis.filter((k) => k.status === "reported").length, total: s.impact_kpis.length };
}

function portfolioStat(s: State, field: string): Omit<ResolvedRef, "label" | "href"> & { name: string } | null {
  const c = portfolioCounts(s);
  switch (norm(field)) {
    case "backed":
    case "backedcount":
    case "companiesbacked":
      return { name: "Companies backed", value: String(c.backed), provenance: "scenario" };
    case "active":
    case "activecompanies":
      return { name: "Active companies", value: String(c.active), provenance: "scenario" };
    case "exits":
    case "exitcount":
      return { name: "Exits", value: String(c.exits), provenance: "public" };
    case "firmrating":
    case "rating":
      return { name: "Founders' rating of Rypples", value: c.firmRating == null ? "pending" : c.firmRating.toFixed(1), provenance: "illustrative" };
    case "overbenchmark":
      return { name: "Constraints over benchmark", value: String(c.overBenchmark), provenance: "illustrative" };
    case "programsrunning":
    case "programs":
      return { name: "Programs running", value: String(programsRunning(s)), provenance: "illustrative" };
    case "lessonssent":
    case "lessons":
      return { name: "Lessons sent to founders", value: String(lessonsSent(s)), provenance: "illustrative" };
    case "impactreporting":
    case "impact": {
      const i = impactReporting(s);
      return { name: "Companies reporting impact", value: `${i.reported} of ${i.total}`, provenance: "illustrative" };
    }
    default:
      return null;
  }
}

export function resolveRef(s: State, ref: RefInput): ResolvedRef | null {
  const f = norm(ref.field);
  switch (norm(ref.type)) {
    case "portfoliostats":
    case "portfolio": {
      const r = portfolioStat(s, ref.field) ?? portfolioStat(s, ref.id);
      if (!r) return null;
      const href = ["programsrunning", "programs"].includes(norm(ref.field)) ? "/os/operating-partners" : ["lessonssent", "lessons"].includes(norm(ref.field)) ? "/os/playbook" : ["impactreporting", "impact"].includes(norm(ref.field)) ? "/os/investor-relations?tab=impact" : "/os/portfolio";
      return { value: r.value, provenance: r.provenance, label: `Portfolio statistic · ${r.name}`, href };
    }
    case "company": {
      const c = s.companies.find((x) => x.id === ref.id || x.slug === ref.id);
      if (!c) return null;
      const href = `/os/companies/${c.slug}`;
      const label = (what: string) => `Company record · ${c.name} · ${what}`;
      if (["name"].includes(f)) return { value: c.name, provenance: c.provenance, label: label("name"), href };
      if (["roundclosedat", "roundclosed", "roundclose"].includes(f)) {
        if (!c.round_closed_at) return null;
        return { value: fullDate(parseIso(c.round_closed_at)), provenance: c.provenance, label: label("round closed"), href };
      }
      if (["day", "dayinfirst100", "dayno"].includes(f)) {
        if (!c.round_closed_at) return null;
        return { value: String(dayInFirst100(c.round_closed_at)), provenance: "scenario", label: label("day of the first 100"), href };
      }
      if (f === "stage" && c.stage) return { value: c.stage, provenance: c.provenance, label: label("stage"), href };
      if (f === "vertical" && c.vertical) return { value: c.vertical, provenance: c.provenance, label: label("vertical"), href };
      if (f === "region" && c.region) return { value: c.region, provenance: c.provenance, label: label("region"), href };
      if (f === "status") return { value: c.status, provenance: c.provenance, label: label("status"), href };
      // Ref values are spliced into sentences, so they carry no closing full stop of their own.
      if ((f === "exitnote" || f === "exit") && c.exit_note) return { value: c.exit_note.replace(/\.$/, ""), provenance: "public", label: label("exit note"), href };
      return null;
    }
    case "lesson": {
      const l = s.lessons.find((x) => x.id === ref.id);
      if (!l) return null;
      const label = (what: string) => `Playbook lesson · ${l.id} · ${what}`;
      const href = "/os/playbook";
      if (f === "title") return { value: l.title, provenance: l.provenance, label: label("title"), href };
      if (f === "status") return { value: l.status, provenance: l.provenance, label: label("status"), href };
      if (f === "learnedin") return { value: l.learned_in, provenance: l.provenance, label: label("learned in"), href };
      if (f === "domain") return { value: s.domains.find((d) => d.slug === l.domain_id)?.label ?? l.domain_id, provenance: l.provenance, label: label("domain"), href };
      if (f === "sent") {
        const n = (l.sent ?? 0) + s.extras.sentLessons.filter((x) => x.lesson_id === l.id).length;
        return { value: String(n), provenance: "illustrative", label: label("sent"), href };
      }
      if (f === "helped") {
        const n = (l.helped ?? 0) + s.extras.usefulLessons.filter((x) => x.lesson_id === l.id).length;
        return { value: String(n), provenance: "illustrative", label: label("helped"), href };
      }
      return null;
    }
    case "strategicpath": {
      const p = s.strategic_paths.find((x) => x.id === ref.id || x.company_id === ref.id);
      if (!p) return null;
      const name = s.companies.find((c) => c.id === p.company_id)?.name ?? p.company_id;
      const label = (what: string) => `Strategic path · ${name} · ${what}`;
      const href = "/os/investor-relations?tab=paths";
      if (f === "now" || f === "relationships") return { value: p.now, provenance: p.now_provenance, label: label("relationships today"), href };
      if (f === "likely") return { value: p.likely, provenance: "illustrative", label: label("likely buyers"), href };
      if (f === "programstatus" || f === "program") return { value: p.program_status, provenance: "scenario", label: label("program status"), href };
      return null;
    }
    case "fact": {
      const fact = s.facts.find((x) => x.id === ref.id) ?? s.facts.find((x) => `${x.company_id}.${x.key}` === ref.id || `${x.company_id}:${x.key}` === ref.id);
      if (!fact) return null;
      const co = s.companies.find((c) => c.id === fact.company_id);
      const href = co ? `/os/companies/${co.slug}` : null;
      if (f === "label") return { value: fact.label, provenance: fact.provenance, label: `Fact · ${fact.label}`, href };
      return { value: fact.value, provenance: fact.provenance, label: `Fact · ${co?.name ?? fact.company_id} · ${fact.label}`, href };
    }
    case "exit": {
      const c = s.companies.find((x) => x.id === ref.id || x.slug === ref.id) ?? s.companies.find((x) => x.status === "exited");
      if (!c || c.status !== "exited") return null;
      const pkg = exitPackage(s);
      const href = "/os/playbook";
      if (["package", "amount", "value", "size", "dealvalue"].includes(f)) {
        if (!pkg) return null;
        return { value: pkg, provenance: "public", label: `Exit · ${c.name} · package size (Playbook timeline)`, href };
      }
      if (c.exit_note) {
        const note = c.exit_note.replace(/\.$/, "");
        const value = f === "note" || !pkg ? note : `${note}, part of ${pkg} across four underwater deals`;
        return { value, provenance: "public", label: `Exit · ${c.name} · exit note`, href };
      }
      return null;
    }
    default:
      return null;
  }
}

export const refKey = (r: RefInput) => `${r.type}:${r.id}:${r.field}`;
