/**
 * Active prompt versions per flow (docs/07-ai.md §2). Never edit a released version: add v<n+1>
 * and point here only after it matches or beats the current one on the evals.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { longDay, scenarioDate } from "@/lib/scenario";

export const ACTIVE = {
  _shared: "v1",
  diagnostic: "v1",
  "any-company": "v1",
  captain: "v1",
  "lesson-match": "v1",
  "board-pack": "v1",
  "shareholder-update": "v1",
  "day-one": "v1",
  judge: "v1",
} as const;
export type PromptFlow = keyof typeof ACTIVE;

export type Prompt = { id: string; version: string; model: string; notes: string; sections: Record<string, string> };

const cache = new Map<string, Prompt>();

export function parsePrompt(id: string, md: string): Prompt {
  const fm = md.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Record<string, string> = {};
  for (const line of (fm?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = fm ? md.slice(fm[0].length) : md;
  const sections: Record<string, string> = {};
  let cur: string | null = null;
  for (const line of body.split("\n")) {
    const h = line.match(/^## (\S+)\s*$/);
    if (h) {
      cur = h[1]!.toLowerCase();
      sections[cur] = "";
    } else if (cur) sections[cur] += `${line}\n`;
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k]!.trim();
  return { id, version: meta.version ?? "v1", model: meta.model ?? "", notes: meta.notes ?? "", sections };
}

export function loadPrompt(flow: PromptFlow): Prompt {
  const version = ACTIVE[flow];
  const id = `${flow}@${version}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const file = path.join(process.cwd(), "lib", "ai", "prompts", flow, `${version}.md`);
  const p = parsePrompt(id, fs.readFileSync(file, "utf8"));
  cache.set(id, p);
  return p;
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

/** A section of a flow prompt with the shared tone block prepended where asked. */
export function section(flow: PromptFlow, name: string, vars: Record<string, string> = {}): string {
  const p = loadPrompt(flow);
  const s = p.sections[name];
  if (s == null) throw new Error(`Prompt ${p.id} has no section "${name}"`);
  return fill(s, vars);
}

export function tone(): string {
  return fill(loadPrompt("_shared").sections.tone!, { scenario_date: `${longDay(scenarioDate())} ${scenarioDate().getUTCFullYear()}` });
}

export const promptVersion = (flow: PromptFlow) => `${flow}@${ACTIVE[flow]}`;
