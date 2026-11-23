import { z } from "zod";
import { ScopeError } from "@/lib/viewer";
import { allow, defineTool, founderCompanyId, NotFoundError, ref, stateFor, uniqRefs } from "./types";
import { lessonsVisibleTo } from "./search-playbook";

const SCOPES = ["rypples", "public", "founder"] as const;
export const getLesson = defineTool({
  name: "get_lesson",
  title: "Playbook lesson",
  description:
    "One Playbook lesson by id: title, status (approved or proposed), the play, the timeline with sources, and the companies it is matched to with the reason and fit. Use to answer who should hear a lesson next.",
  input: z.object({ id: z.string().min(1).max(100) }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const l = s.lessons.find((x) => x.id === input.id);
    const visible = lessonsVisibleTo(s, founderCompanyId(ctx));
    if (visible && (!l || !visible.has(l.id))) throw new ScopeError();
    if (!l) throw new NotFoundError(`No lesson "${input.id}"`);
    const matches = visible ? [] : s.lesson_matches.filter((m) => m.lesson_id === l.id);
    const company = (id: string) => s.companies.find((c) => c.id === id);
    const srcs = l.timeline.map((t) => s.sources.find((x) => x.id === t.source_id)).filter((x): x is NonNullable<typeof x> => !!x);
    const data = {
      id: l.id,
      title: l.title,
      domain: l.domain_id,
      status: l.status,
      learned_in: l.learned_in,
      play: l.play,
      timeline: l.timeline.map((t) => ({ date: t.label || t.date, event: t.event, source_url: s.sources.find((x) => x.id === t.source_id)?.url ?? null, provenance: t.provenance })),
      matches: matches.map((m) => ({ company: company(m.company_id)?.name ?? m.company_id, slug: m.company_id, reason: m.reason, fit: m.fit, status: m.status, provenance: m.reason_provenance, verify_note: m.verify_note })),
      provenance: l.provenance,
    };
    const companyRefs = matches.map((m) => company(m.company_id)).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ref.company(c, ctx.viewer));
    return { data, refs: uniqRefs([ref.lesson(l.id, l.title, l.provenance), ...companyRefs, ...srcs.map((x) => ref.source(x.id, x.title, x.url))]) };
  },
});
