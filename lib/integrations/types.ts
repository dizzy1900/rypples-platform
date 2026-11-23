/**
 * Integration interfaces (docs/08-mcp-and-integrations.md §4). The prototype ships demo adapters
 * backed by fixtures; production implements the same interfaces as MCP clients or API adapters.
 */
export type SystemName = "Drive" | "CRM" | "Meeting notes" | "Finance system";
export type SourceTag = { system: SystemName; demo: boolean };

export type DocRef = { id: string; companyId: string; name: string; type: string; modified: string; url: string; source: SourceTag };
export type DealRef = { id: string; codename: string; stage: string; source: SourceTag };
export type DealDetail = DealRef & { what: string; vertical: string; region: string; contacts: { role: string; last_touch: string }[] };
export type SessionNote = { id: string; kind: "board" | "expert" | "circle"; title: string; who: string; held_at: string; confidential: boolean; source: SourceTag };
export type Kpi = { key: string; label: string; value: string; asOf: string; source: SourceTag };

export interface DocumentStore {
  listFolder(companyId: string): Promise<DocRef[]>;
  getText(doc: DocRef): Promise<{ text: string; url: string; source: SourceTag }>;
}
export interface Crm {
  listDeals(): Promise<DealRef[]>;
  getDeal(id: string): Promise<DealDetail | null>;
}
export interface MeetingNotes {
  listSince(date: string): Promise<SessionNote[]>;
  /** Circles: themes only, never raw notes. */
  getThemes(id: string): Promise<string[]>;
}
export interface FinanceSystem {
  getKpis(companyId: string): Promise<Kpi[]>;
}

export type IntegrationRegistration = { id: string; name: string; system: string; demo: boolean; status: "connected" | "available" };
