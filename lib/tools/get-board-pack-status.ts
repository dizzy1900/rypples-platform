import { z } from "zod";
import { offsetLabel } from "@/lib/scenario";
import { allow, companyFor, defineTool, isFounder, NotFoundError, ref, stateFor } from "./types";

const SCOPES = ["rypples", "founder"] as const;
export const getBoardPackStatus = defineTool({
  name: "get_board_pack_status",
  title: "Board pack status",
  description: "The state of each section of a company's next board pack (needs the founder, ready, drafted) and the meeting date. Never returns financial values. Input is the company slug.",
  input: z.object({ slug: z.string().min(1).max(100) }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const c = companyFor(ctx, s, input.slug);
    const pack = s.board_packs.find((p) => p.company_id === c.id);
    if (!pack) throw new NotFoundError(`No board pack in preparation for ${c.name}`);
    const sections = s.board_pack_sections.filter((x) => x.pack_id === pack.id).sort((a, b) => a.sort - b.sort);
    const data = {
      company: c.name,
      quarter: pack.quarter,
      meeting: offsetLabel(pack.meeting_offset),
      status: pack.status,
      sections: sections.map((x) => ({ key: x.key, name: x.name, state: x.state, state_label: x.state_label })),
      needs_founder: sections.filter((x) => x.state === "needs").length,
    };
    return { data, refs: [ref.boardPack(pack.id, c.name, c.slug, isFounder(ctx))] };
  },
});
