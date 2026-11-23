/**
 * View models for S5a (diagnostic on a source pack) and S5b (run on any ocean company).
 * Pure functions of State (plus a run result for S5b).
 */
import type { State } from "../state";
import type { DomainSlug, DimensionScore, Evidence } from "@/lib/domain/schemas";
import type { AnyCompanyResult, EvidenceItem, ScoredDomain } from "@/lib/ai/types";
import { fullDate, parseIso } from "@/lib/scenario";

export type DomainOption = { slug: DomainSlug; label: string };
export type PackDoc = { id: string; title: string; kind: string; url: string; snapshot: string; source_id: string };
export type ProposedView = {
  diagnostic_id: string;
  status: "proposed" | "confirmed" | "disputed";
  confirmed_label: string | null;
  binding_domain: DomainSlug | null;
  /** the domain the agent proposed (is_binding score row); differs from binding_domain after an adjustment */
  proposed_domain: DomainSlug | null;
  binding_statement: string | null;
  scores: ScoredDomain[];
  evidence: EvidenceItem[];
};

export function domainOptions(s: State): DomainOption[] {
  return [...s.domains].sort((a, b) => a.sort - b.sort).map((d) => ({ slug: d.slug, label: d.label }));
}

/** source_id → "23 Nov 2026" (snapshot accessed date). */
export function sourceDates(s: State): Record<string, string> {
  return Object.fromEntries(s.sources.map((x) => [x.id, fullDate(parseIso(x.accessed_at))]));
}

export function toScored(d: DimensionScore): ScoredDomain {
  const sc = d.score;
  return {
    domain: d.domain_id,
    score: sc == null ? null : (Math.max(1, Math.min(5, sc)) as ScoredDomain["score"]),
    confidence: d.confidence,
    finding: d.finding,
    evidence_ids: d.evidence_ids,
  };
}

export function toEvidenceItem(e: Evidence): EvidenceItem {
  const loc = e.location as { source_id?: unknown; start?: unknown; end?: unknown } | null;
  return {
    id: e.id,
    claim: e.claim,
    cited_text: e.cited_text,
    url: e.url,
    title: e.title,
    location:
      loc && typeof loc.start === "number" && typeof loc.end === "number"
        ? { source_id: String(loc.source_id ?? e.source_id ?? ""), start: loc.start, end: loc.end }
        : null,
  };
}

export function getPackView(s: State, slug: string) {
  const company = s.companies.find((c) => c.slug === slug && c.status !== "unannounced");
  if (!company) return null;
  const docs: PackDoc[] = s.documents
    .filter((d) => d.company_id === company.id)
    .map((d) => {
      const src = s.sources.find((x) => x.id === d.source_id);
      return {
        id: d.id,
        title: d.title,
        kind: d.kind,
        url: src?.url ?? "",
        snapshot: src ? fullDate(parseIso(src.accessed_at)) : "",
        source_id: d.source_id,
      };
    });
  const latest = [...s.extras.proposedDiagnostics].reverse().find((p) => p.company_id === company.id) ?? null;
  const proposed: ProposedView | null = latest
    ? {
        diagnostic_id: latest.diagnostic.id,
        status: latest.diagnostic.status,
        confirmed_label: latest.diagnostic.confirmed_label ?? null,
        binding_domain: latest.diagnostic.binding_domain_id,
        proposed_domain: latest.scores.find((x) => x.is_binding)?.domain_id ?? latest.diagnostic.binding_domain_id,
        binding_statement: latest.diagnostic.binding_statement,
        scores: latest.scores.map(toScored),
        evidence: latest.evidence.map(toEvidenceItem),
      }
    : null;
  return {
    company: { id: company.id, slug: company.slug, name: company.name },
    docs,
    proposed,
    domains: domainOptions(s),
    sourceDates: sourceDates(s),
  };
}

export function getRunView(s: State, run: AnyCompanyResult) {
  const syn = run.synthesis;
  const programs = (syn?.program_ids ?? [])
    .map((id) => s.programs.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 2)
    .map((p) => ({ id: p.id, name: p.name, outcome: p.outcome, weeks: p.length_weeks, hours: p.hours, provenance: p.provenance }));
  const lessons = (syn?.lesson_ids ?? [])
    .map((id) => s.lessons.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => !!l)
    .map((l) => ({ id: l.id, title: l.title, learned_in: l.learned_in }));
  const distinctSources = new Set([...run.sources.map((x) => x.url), ...run.evidence.map((e) => e.url).filter(Boolean)]).size;
  return {
    programs,
    lessons,
    domains: domainOptions(s),
    distinctSources,
    date: fullDate(new Date(run.created_at)),
    takenCodenames: s.deals.map((d) => d.codename),
  };
}

/** Three real portfolio companies (with websites) as S5b example chips. */
export function exampleCompanies(s: State) {
  const prefer = ["hullbot", "coral-vita", "flocean"];
  const withSite = s.companies.filter((c) => c.status === "active" && c.public && c.website);
  const picked = prefer.map((id) => withSite.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  for (const c of withSite) if (picked.length < 3 && !picked.includes(c)) picked.push(c);
  return picked.slice(0, 3).map((c) => ({ name: c.name, website: c.website as string }));
}

export const hostOf = (url: string | null | undefined) => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
