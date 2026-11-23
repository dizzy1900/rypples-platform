import data from "@/data/seed/integrations/drive.json";
import type { DocRef, DocumentStore, SourceTag } from "../types";

const source: SourceTag = { system: "Drive", demo: true };
const folders = data.folders as Record<string, Omit<DocRef, "companyId" | "source">[]>;
const texts = data.texts as Record<string, string>;

export const demoDrive: DocumentStore = {
  async listFolder(companyId) {
    return (folders[companyId] ?? []).map((d) => ({ ...d, companyId, source }));
  },
  async getText(doc) {
    return { text: texts[doc.id] ?? "Demo connection. File contents are not stored in this prototype.", url: doc.url, source };
  },
};
