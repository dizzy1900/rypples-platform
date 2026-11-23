/** Viewer and permissions (docs/03-architecture.md §6). */
export type Viewer =
  | { kind: "rypples"; firmId: string; personId: "jerome" }
  | { kind: "founder"; firmId: string; companyId: string; personId: string };

export type PublicViewer = { kind: "public"; firmId: string };
export type AnyViewer = Viewer | PublicViewer;

export const JEROME: Viewer = { kind: "rypples", firmId: "rypples", personId: "jerome" };
export const PUBLIC_VIEWER: PublicViewer = { kind: "public", firmId: "rypples" };

export function founderViewer(companyId: string, personId: string): Viewer {
  return { kind: "founder", firmId: "rypples", companyId, personId };
}

export class ScopeError extends Error {
  constructor(message = "Not available in your view") {
    super(message);
    this.name = "ScopeError";
  }
}

/** Founders see only their own company. Rypples and public viewers see any public company. */
export function assertCompanyScope(viewer: AnyViewer, companyId: string) {
  if (viewer.kind === "founder" && viewer.companyId !== companyId) throw new ScopeError();
}

export const actorFor = (v: Viewer) => (v.kind === "rypples" ? v.personId : `founder:${v.companyId}`);
