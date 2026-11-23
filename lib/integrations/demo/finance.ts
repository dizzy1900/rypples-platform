import data from "@/data/seed/integrations/finance.json";
import type { FinanceSystem, Kpi, SourceTag } from "../types";

const source: SourceTag = { system: "Finance system", demo: true };
const kpis = data.kpis as Record<string, Omit<Kpi, "source">[]>;

/** Masked values (••••) with real as-of dates. Never real figures. */
export const demoFinance: FinanceSystem = {
  async getKpis(companyId) {
    return (kpis[companyId] ?? []).map((k) => ({ ...k, value: "••••", source }));
  },
};
