import { z } from "zod";
import { allow, companyFor, defineTool, NotFoundError, ref, stateFor, uniqRefs } from "./types";

const SCOPES = ["rypples", "public", "founder"] as const;
export const getDiagnostic = defineTool({
  name: "get_diagnostic",
  title: "Company diagnostic",
  description:
    "The latest confirmed diagnostic for a company: the binding constraint, the eight domain scores (1-5 or null for an evidence gap) with confidence and findings, the questions to ask, and the evidence behind each score (claim, cited text, source URL). Input is the company slug.",
  input: z.object({ slug: z.string().min(1).max(100) }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const c = companyFor(ctx, s, input.slug);
    const fromSession = [...s.extras.proposedDiagnostics].reverse().find((p) => p.company_id === c.id && p.diagnostic.status === "confirmed");
    const seeded = [...s.diagnostics].reverse().find((d) => d.company_id === c.id && d.status === "confirmed");
    const diag = fromSession?.diagnostic ?? seeded;
    if (!diag) throw new NotFoundError(`No confirmed diagnostic for ${c.name} yet`);
    const scores = fromSession?.scores ?? s.dimension_scores.filter((x) => x.diagnostic_id === diag.id);
    const evidence = fromSession?.evidence ?? s.evidence.filter((e) => scores.some((x) => x.evidence_ids.includes(e.id)));
    const label = (d: string) => s.domains.find((x) => x.slug === d)?.label ?? d;
    const data = {
      diagnostic_id: diag.id,
      company: c.name,
      status: diag.status,
      confirmed_label: diag.confirmed_label,
      binding: { domain: diag.binding_domain_id, label: diag.binding_domain_id ? label(diag.binding_domain_id) : null, statement: diag.binding_statement, detail: diag.binding_detail },
      questions: diag.questions,
      scores: [...s.domains]
        .sort((a, b) => a.sort - b.sort)
        .map((d) => {
          const sc = scores.find((x) => x.domain_id === d.slug);
          return { domain: d.slug, label: d.label, score: sc?.score ?? null, confidence: sc?.confidence ?? "low", finding: sc?.finding ?? "Evidence gap", evidence_ids: sc?.evidence_ids ?? [] };
        }),
      evidence: evidence.map((e) => ({ id: e.id, claim: e.claim, cited_text: e.cited_text, url: e.url ?? s.sources.find((x) => x.id === e.source_id)?.url ?? null, title: e.title })),
      provenance: diag.provenance,
    };
    const srcRefs = evidence
      .map((e) => s.sources.find((x) => x.id === e.source_id))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => ref.source(x.id, x.title, x.url));
    return { data, refs: uniqRefs([ref.diagnostic(diag.id, c.name, c.slug, diag.provenance), ref.company(c, ctx.viewer), ...srcRefs]) };
  },
});
