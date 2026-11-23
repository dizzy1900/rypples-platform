/**
 * Fetches every source in data/seed/sources.json and stores readable text at
 * data/sources/<id>.md with front matter. Run: npx tsx scripts/snapshot-sources.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ACCESSED = "2026-11-23";

type Src = { id: string; url: string; title: string };

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function pageTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).replace(/\s+/g, " ").trim() : null;
}

/** Next.js RSC pages keep content in flight data; pull card fields when visible text is thin. */
function rscFallback(html: string): string {
  const h = html.replace(/\\"/g, '"');
  const out: string[] = [];
  const re = /"name":"([^"]+)","tagline":"([^"]*)","description":"([^"]*)"[\s\S]*?"vertical":"([^"]*)","geography":"([^"]*)"[\s\S]*?"website":"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(h))) out.push(`${m[1]}. ${m[2]}. ${m[3]} Vertical: ${m[4]}. Region: ${m[5]}. Website: ${m[6] || "none listed"}`);
  return out.join("\n\n");
}

function toText(html: string): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|svg|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  t = decode(t);
  return t
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const q = (s: string) => JSON.stringify(s);

async function main() {
  const sources: Src[] = JSON.parse(readFileSync(join(ROOT, "data/seed/sources.json"), "utf8"));
  mkdirSync(join(ROOT, "data/sources"), { recursive: true });
  const failed: string[] = [];
  for (const s of sources) {
    let body = "";
    let title = s.title;
    let note = "";
    try {
      const res = await fetch(s.url, {
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (compatible; RypplesSeedBot/1.0)", accept: "text/html,*/*" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      title = pageTitle(html) ?? s.title;
      body = toText(html);
      if (body.length < 400) {
        const alt = rscFallback(html);
        if (alt) body = alt;
      }
      if (body.length < 200) throw new Error("no readable text extracted");
    } catch (e) {
      note = `Fetch failed (${(e as Error).message}). Treat claims from this source as unverified.`;
      body = "";
    }
    const fm = ["---", `url: ${q(s.url)}`, `title: ${q(title)}`, `accessed_at: ${ACCESSED}`];
    if (note) fm.push("status: unavailable", `note: ${q(note)}`);
    fm.push("---", "");
    writeFileSync(join(ROOT, "data/sources", `${s.id}.md`), fm.join("\n") + (note ? note + "\n" : body + "\n"));
    console.log(`${note ? "UNAVAILABLE" : "ok         "} ${s.id} ${body.length}`);
    if (note) failed.push(s.id);
  }
  console.log(failed.length ? `Unavailable: ${failed.join(", ")}` : "All sources fetched");
}
main();
