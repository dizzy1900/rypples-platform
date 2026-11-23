import deals from "@/data/seed/deals.json";
import data from "@/data/seed/integrations/crm.json";
import type { Crm, DealRef, SourceTag } from "../types";

const source: SourceTag = { system: "CRM", demo: true };
const contacts = data.contacts as Record<string, { role: string; last_touch: string }[]>;
type SeedDeal = { id: string; codename: string; stage: string; what: string; vertical: string; region: string };
const rows = deals as SeedDeal[];

export const demoCrm: Crm = {
  async listDeals(): Promise<DealRef[]> {
    return rows.map((d) => ({ id: d.id, codename: d.codename, stage: d.stage, source }));
  },
  async getDeal(id) {
    const d = rows.find((x) => x.id === id);
    if (!d) return null;
    return { id: d.id, codename: d.codename, stage: d.stage, what: d.what, vertical: d.vertical, region: d.region, contacts: contacts[id] ?? [], source };
  },
};
