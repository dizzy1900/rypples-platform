/**
 * Evidence helpers shared by F1 and F2 (docs/07-ai.md §2, F2 step 2): citations become
 * evidence rows with stable IDs; de-duplication on url + cited_text; at most 40 items.
 */
import type { BetaContentBlock, BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { EvidenceItem } from "./types";

export const MAX_EVIDENCE = 40;
export const MAX_CITED = 300;

const TWO_LEVEL = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "ltd.uk", "plc.uk", "com.au", "net.au", "org.au", "co.nz", "org.nz",
  "com.br", "co.jp", "co.za", "com.sg", "com.mx", "com.cn", "com.hk", "co.in", "co.kr", "com.tr", "com.ar",
  "co.il", "com.my", "com.ph", "co.id", "com.tw", "com.co", "com.pe", "com.vn", "com.sa", "com.eg",
]);

/** "https://www.example.co.uk/path" → "example.co.uk" */
export function registrableDomain(hostOrUrl: string): string | null {
  let host = hostOrUrl.trim().toLowerCase();
  try {
    host = new URL(/^[a-z]+:\/\//.test(host) ? host : `https://${host}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\d?\./, "").replace(/\.$/, "");
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2 || !/^[a-z0-9-]+$/.test(labels[labels.length - 1]!)) return null;
  const last2 = labels.slice(-2).join(".");
  if (TWO_LEVEL.has(last2) && labels.length >= 3) return labels.slice(-3).join(".");
  return last2;
}

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const stripControl = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

export type NormalisedQuery = { raw: string; isUrl: boolean; domain: string | null; nameSlug: string; key: string; display: string };

/** Normalise an F2 query (a name or URL, ≤ 200 chars) and derive the cache key. */
export function normaliseQuery(q: string): NormalisedQuery {
  const raw = stripControl(q).trim().replace(/\s+/g, " ").slice(0, 200);
  const looksUrl = /^[a-z]+:\/\//i.test(raw) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(raw);
  const domain = looksUrl ? registrableDomain(raw) : null;
  const nameSlug = slugify(domain ? domain.split(".")[0]! : raw);
  return { raw, isUrl: !!domain, domain, nameSlug, key: domain ?? `name:${nameSlug}`, display: domain ?? raw };
}

export const nameKey = (name: string) => `name:${slugify(name)}`;

/** Collects evidence with stable IDs, de-duplicated on url + cited_text. */
export class EvidenceCollector {
  readonly items: EvidenceItem[] = [];
  private seen = new Set<string>();
  constructor(private prefix: string, private max = MAX_EVIDENCE) {}
  add(e: Omit<EvidenceItem, "id">): EvidenceItem | null {
    const cited = e.cited_text.replace(/\s+/g, " ").trim();
    if (!cited) return null;
    const k = `${(e.url ?? e.location?.source_id ?? "").toLowerCase()}|${cited.toLowerCase()}`;
    if (this.seen.has(k) || this.items.length >= this.max) return null;
    this.seen.add(k);
    const item: EvidenceItem = {
      id: `${this.prefix}-${String(this.items.length + 1).padStart(2, "0")}`,
      claim: e.claim.replace(/\s+/g, " ").trim().slice(0, 400) || cited.slice(0, 200),
      cited_text: cited.length > MAX_CITED ? `${cited.slice(0, MAX_CITED - 1)}…` : cited,
      url: e.url,
      title: e.title,
      location: e.location ?? null,
    };
    this.items.push(item);
    return item;
  }
}

export type PackDoc = { source_id: string; title: string; url: string };

/** F1: document-block citations (char_location) → evidence linked to the snapshot. */
export function documentCitations(msg: BetaMessage, docs: PackDoc[], col: EvidenceCollector): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const b of msg.content) {
    if (b.type !== "text" || !b.citations?.length) continue;
    for (const c of b.citations) {
      if (c.type !== "char_location") continue;
      const d = docs[c.document_index];
      if (!d) continue;
      const item = col.add({
        claim: b.text,
        cited_text: c.cited_text,
        url: d.url,
        title: d.title,
        location: { source_id: d.source_id, start: c.start_char_index, end: c.end_char_index },
      });
      if (item) out.push(item);
    }
  }
  return out;
}

/** F2: sources seen in a research response (search results and fetched pages). */
export function sourcesIn(block: BetaContentBlock): { url: string; title: string }[] {
  if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
    return block.content.map((r) => ({ url: r.url, title: r.title }));
  }
  if (block.type === "web_fetch_tool_result" && block.content.type === "web_fetch_result") {
    return [{ url: block.content.url, title: block.content.content.title ?? block.content.url }];
  }
  return [];
}

const SOCIAL = /(^|\.)(linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|youtube\.com)$/;
export const isSocial = (url: string | null) => {
  if (!url) return false;
  const d = registrableDomain(url);
  return !!d && SOCIAL.test(d);
};

/** F2: every citation in the research response → evidence (web search result locations and fetched-document char locations). */
export function webCitations(content: BetaContentBlock[], col: EvidenceCollector): EvidenceItem[] {
  const fetched: { url: string; title: string }[] = [];
  for (const b of content) {
    if (b.type === "web_fetch_tool_result" && b.content.type === "web_fetch_result") {
      fetched.push({ url: b.content.url, title: b.content.content.title ?? b.content.url });
    }
  }
  const out: EvidenceItem[] = [];
  for (const b of content) {
    if (b.type !== "text" || !b.citations?.length) continue;
    for (const c of b.citations) {
      let url: string | null = null;
      let title = "";
      let location: EvidenceItem["location"] = null;
      if (c.type === "web_search_result_location") {
        url = c.url;
        title = c.title ?? c.url;
      } else if (c.type === "char_location") {
        const d = fetched.find((f) => f.title === c.document_title) ?? fetched[c.document_index];
        if (!d) continue;
        url = d.url;
        title = d.title;
        location = { source_id: d.url, start: c.start_char_index, end: c.end_char_index };
      } else continue;
      const item = col.add({ claim: b.text, cited_text: c.cited_text, url, title, location });
      if (item) out.push(item);
    }
  }
  return out;
}

export function distinctSourceDomains(evidence: Pick<EvidenceItem, "url">[]): number {
  return new Set(evidence.map((e) => (e.url ? registrableDomain(e.url) : null)).filter(Boolean)).size;
}

/** Strip YAML front matter from a snapshot; char offsets in seed evidence are relative to this body. */
export function snapshotBody(md: string): string {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---", 3);
  if (end < 0) return md;
  return md.slice(end + 4).replace(/^\n/, "");
}
