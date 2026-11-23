/**
 * Cached-mode content (docs/07-ai.md §5). Fixed files are imported statically so they ship with the
 * server bundle; F2 runs are read from disk by slug and shown only when `reviewed: true`.
 */
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import f1 from "@/data/precomputed/f1-desolenator.json";
import f3 from "@/data/precomputed/f3-captain.json";
import f4 from "@/data/precomputed/f4-wsense.json";
import f5 from "@/data/precomputed/f5-desolenator.json";
import f6 from "@/data/precomputed/f6-q4.json";
import f7 from "@/data/precomputed/f7-tern.json";
import overnight from "@/data/precomputed/overnight.json";
import type { FlowEvent } from "./sse";
import type { AnyCompanyResult, DiagnosticResult, LessonMatchResult, ShareholderSegment } from "./types";
import type { DayOnePlanT } from "./schemas/day-one";

export type Meta = { authored: boolean; model: string; reviewed: boolean; prompt_version?: string };

export type F1File = Meta & { company_id: string; events: FlowEvent[]; result: Omit<DiagnosticResult, "diagnostic_id" | "replayed"> };
export type CaptainCached = {
  id: string;
  scope: "os" | "bridge";
  prompt: string;
  match: string[][];
  tools: { name: string; input: Record<string, unknown> }[];
  text: string;
  caveats: string[];
  next_steps: { title: string; detail: string; target: string | null }[];
};
export type F3File = Meta & { seeded: { label: string; answer_id: string }; prompts: { os: string[]; bridge: string[] }; answers: CaptainCached[] };
export type F4File = Meta & { result: LessonMatchResult };
export type F5File = Meta & { company_id: string; sections: { letter: string; asks: string } };
export type F6File = Meta & { quarter: string; title: string; draft_n: number; segments: ShareholderSegment[]; held_back: { type: string; id: string; reason: string }[] };
export type F7File = Meta & { deal_id: string; plan: DayOnePlanT };
export type OvernightFile = Meta & { items: { id: string; minutes: number }[] };

export const precomputed = {
  f1: f1 as unknown as F1File,
  f3: f3 as unknown as F3File,
  f4: f4 as unknown as F4File,
  f5: f5 as unknown as F5File,
  f6: f6 as unknown as F6File,
  f7: f7 as unknown as F7File,
  overnight: overnight as unknown as OvernightFile,
};

const F2_DIR = () => path.join(process.cwd(), "data", "precomputed", "f2");

/** A reviewed precomputed F2 run whose key matches (file slug = name slug or registrable domain's first label). */
export async function reviewedF2(keys: string[]): Promise<AnyCompanyResult | null> {
  for (const k of keys) {
    if (!/^[a-z0-9-]+$/.test(k)) continue;
    try {
      const raw = JSON.parse(await fs.readFile(path.join(F2_DIR(), `${k}.json`), "utf8")) as Partial<AnyCompanyResult> & { result?: AnyCompanyResult };
      const r = (raw.result ?? raw) as AnyCompanyResult;
      if (r && r.reviewed === true && raw.reviewed !== false) return r;
    } catch {
      /* not precomputed */
    }
  }
  return null;
}

/** Test fixtures (reviewed: false), for tests only. */
export async function f2Fixture(name: "ok" | "declined" | "ambiguous" | "insufficient" | "error") {
  return JSON.parse(await fs.readFile(path.join(F2_DIR(), "_fixtures", `${name}.json`), "utf8")) as Meta & { result: AnyCompanyResult | null; error?: string };
}
