import { z } from "zod";
import { allow, defineTool, founderCompanyId, ref, stateFor } from "./types";
import type { State } from "@/lib/data";

const SCOPES = ["rypples", "public", "founder"] as const;

/** Lessons a founder may read: those sent to their company (seed matches with status sent, or sent in session). */
export function lessonsVisibleTo(s: State, companyId: string | null): Set<string> | null {
  if (!companyId) return null;
  const ids = new Set<string>();
  for (const m of s.lesson_matches) if (m.company_id === companyId && m.status === "sent") ids.add(m.lesson_id);
  for (const x of s.extras.sentLessons) if (x.company_id === companyId) ids.add(x.lesson_id);
  return ids;
}

export const searchPlaybook = defineTool({
  name: "search_playbook",
  title: "Search the Playbook",
  description:
    "Search Playbook lessons (what Rypples companies learned clearing a constraint) by free-text query and/or domain. Returns approved and proposed lessons with their status flagged, the play, where each was learned, and library stats (sent, helped). Proposed lessons are not yet approved: say so.",
  input: z.object({
    query: z.string().max(200).optional(),
    domain: z.enum(["commercial", "financing", "operations", "technology", "regulatory", "people", "ai", "impact"]).optional(),
  }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const visible = lessonsVisibleTo(s, founderCompanyId(ctx));
    const words = (input.query ?? "").toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    const lessons = s.lessons
      .filter((l) => l.status !== "rejected")
      .filter((l) => !visible || visible.has(l.id))
      .filter((l) => !input.domain || l.domain_id === input.domain)
      .map((l) => {
        const hay = `${l.title} ${l.play.join(" ")} ${l.learned_in} ${l.domain_id}`.toLowerCase();
        return { l, hits: words.filter((w) => hay.includes(w)).length };
      })
      .filter((x) => !words.length || x.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    const data = {
      lessons: lessons.map(({ l }) => ({
        id: l.id,
        title: l.title,
        domain: l.domain_id,
        status: l.status,
        learned_in: l.learned_in,
        play: l.play,
        in_library: l.in_library,
        sent: l.sent,
        helped: l.helped,
        provenance: l.provenance,
      })),
      library: { approved: s.lessons.filter((l) => l.status === "approved").length, proposed: s.lessons.filter((l) => l.status === "proposed").length },
    };
    return { data, refs: lessons.map(({ l }) => ref.lesson(l.id, l.title, l.provenance)) };
  },
});
