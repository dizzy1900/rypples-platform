/**
 * "Add to pipeline as a codename" (S5b): build the sourced Deal appended with `deal.created`.
 * Pure and client-safe.
 */
import type { Deal, Vertical } from "@/lib/domain/schemas";
import type { AnyCompanyResult } from "./types";

export const SAILING_TERMS = [
  "Jib", "Keel", "Rudder", "Mizzen", "Tack", "Gybe", "Clew", "Cleat", "Capstan", "Windlass", "Sextant",
  "Lanyard", "Topsail", "Forestay", "Backstay", "Gunwale", "Transom", "Ballast", "Leeward", "Windward",
  "Bosun", "Sheet", "Shroud", "Burgee", "Fairlead", "Thwart", "Tiller", "Bilge", "Reef", "Luff",
] as const;

const VERTICALS: Vertical[] = ["Ocean Health", "Ecosystems", "Blue Foods", "Maritime", "Ocean Intelligence"];

export function pickCodename(taken: string[], seed = Math.random()): string {
  const free = SAILING_TERMS.filter((t) => !taken.includes(`Project ${t}`));
  const list = free.length ? free : SAILING_TERMS;
  return `Project ${list[Math.floor(seed * list.length) % list.length]}`;
}

export function dealFromRun(run: AnyCompanyResult, codename: string, id: string): Deal {
  const vertical = (VERTICALS.find((v) => v.toLowerCase() === (run.identity.vertical ?? "").toLowerCase()) ?? "Ocean Health") as Vertical;
  const binding = run.synthesis?.binding_domain ?? null;
  return {
    id,
    firm_id: "rypples",
    codename,
    vertical,
    region: "Unknown",
    stage: "sourced",
    note: `Sourced from a public-record diagnostic of ${run.identity.name}`,
    what: run.identity.description,
    proposed_constraint: run.synthesis?.binding_statement ?? "Public record too thin to propose one",
    constraint_domain_id: binding,
    why: run.synthesis?.rationale ?? "Not enough public evidence yet.",
    evidence_count: run.evidence.length,
    plan_drafts: [],
    partner_note: "Board-level partner match: to be decided at first meeting.",
    lesson_note: run.synthesis?.lesson_ids.length ? "Related Playbook lessons attached to the run." : "No Playbook lesson matched yet.",
    cta_label: "Book first meeting",
    diligence: null,
    data_room: [],
    provenance: "generated",
  };
}
