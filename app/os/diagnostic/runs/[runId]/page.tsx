import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TopBar, Page } from "@/components/shell/TopBar";
import { GeneratedLabel, Prov, PageHeader, Section, Tile } from "@/components/ui";
import { EvidencePopover, ScoreList } from "@/components/rypples/diagnostic/ScoreList";
import { RunActions } from "@/components/rypples/diagnostic/RunActions";
import { getState } from "@/lib/data";
import { getRunView, hostOf } from "@/lib/data/projections/diagnostic";
import { f2Availability, getRun } from "@/lib/ai/runs";
import { getSessionId } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = await getRun(runId);
  return { title: run ? `${run.identity.name} · Diagnostic` : "Diagnostic run" };
}

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) notFound();
  const s = await getState(await getSessionId());
  const v = getRunView(s, run);
  const avail = await f2Availability();
  const shareUrl = `${await siteUrl()}/os/diagnostic/runs/${run.run_id}`;
  const syn = run.synthesis;
  const insufficient = run.status === "insufficient";
  const domainLabel = (d: string | null) => v.domains.find((x) => x.slug === d)?.label ?? d ?? "";
  const evById = new Map(run.evidence.map((e) => [e.id, e]));
  const scored = new Set(run.scores.filter((x) => x.score != null).map((x) => x.domain));
  const gaps = v.domains.filter((d) => !scored.has(d.slug));

  return (
    <>
      <TopBar
        crumbs={[{ label: "Home", href: "/os" }, { label: "Diagnostic", href: "/os/diagnostic/new" }, { label: run.identity.name }]}
        placeholder="Ask Captain about the portfolio"
      />
      <Page>
        <PageHeader
          eyebrow="Diagnostic · public record"
          title={run.identity.name}
          lede={run.identity.description}
        >
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[13px] text-ink-2">
            {run.identity.website && (
              <a href={run.identity.website} target="_blank" rel="noopener noreferrer" className="text-link">
                {hostOf(run.identity.website)}
              </a>
            )}
            {run.identity.vertical && <span>Vertical: {run.identity.vertical} (inferred)</span>}
            <span>Ocean economy: yes. {run.identity.reason}</span>
          </div>
          <GeneratedLabel />
        </PageHeader>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Section id="scores" title="Scores" meta="Eight Growth Engine domains, each with its sources">
            <Tile className="py-2">
              <ScoreList domains={v.domains} scores={run.scores} evidence={run.evidence} bindingDomain={insufficient ? null : syn?.binding_domain} />
            </Tile>
          </Section>

          <div className="flex flex-col gap-8">
            <Section id="binding" title="Proposed binding constraint">
              <Tile className="flex flex-col gap-3">
                {insufficient || !syn?.binding_domain ? (
                  <>
                    <p className="text-[15px] text-ink">The public record is too thin to propose a binding constraint.</p>
                    {gaps.length > 0 && (
                      <p className="text-[13px] text-ink-3">Evidence gaps: {gaps.map((g) => g.label).join(", ")}.</p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="eyebrow">{domainLabel(syn.binding_domain)}</span>
                    {syn.binding_statement && <p className="text-[18px] font-medium text-ink">{syn.binding_statement}</p>}
                    <p className="text-[14px] text-ink-2">{syn.rationale}</p>
                    {syn.evidence_ids.length > 0 && (
                      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="meta">Evidence</span>
                        {syn.evidence_ids
                          .map((id) => evById.get(id))
                          .filter((e): e is NonNullable<typeof e> => !!e)
                          .map((e) => (
                            <EvidencePopover key={e.id} ev={e} label={`${e.title} · ${hostOf(e.url)}`} />
                          ))}
                      </p>
                    )}
                    <p className="meta">A hypothesis from public sources, not a confirmed constraint.</p>
                  </>
                )}
              </Tile>
            </Section>

            {!insufficient && (v.programs.length > 0 || v.lessons.length > 0) && (
              <Section id="help" title="Where Rypples would help first">
                <Tile className="flex flex-col gap-4">
                  {v.programs.map((p) => (
                    <div key={p.id} className="flex flex-col gap-0.5">
                      <span className="text-[14px] font-semibold text-ink">{p.name}</span>
                      <span className="text-[13px] text-ink-2">
                        {p.outcome}.{" "}
                        <Prov p={p.provenance}>
                          {p.weeks} weeks, {p.hours} hours
                        </Prov>
                      </span>
                    </div>
                  ))}
                  {v.lessons.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-line-2 pt-3">
                      <span className="meta">Playbook lessons</span>
                      {v.lessons.map((l) => (
                        <Link key={l.id} href="/os/playbook" className="text-link text-[13px]">
                          {l.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </Tile>
              </Section>
            )}

            {syn && syn.questions.length > 0 && (
              <Section id="ask" title="Ask, don't tell" meta="Three questions for the founder">
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] text-ink-2">
                  {syn.questions.slice(0, 3).map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </Section>
            )}
          </div>
        </div>

        <footer className="flex flex-col gap-4 border-t border-line-2 pt-6">
          <p className="meta">
            Proposed from {v.distinctSources} public {v.distinctSources === 1 ? "source" : "sources"} on {v.date}. Not reviewed by a person.
          </p>
          <RunActions run={run} shareUrl={shareUrl} runAgainAllowed={avail.runAgainAllowed} takenCodenames={v.takenCodenames} />
        </footer>
      </Page>
    </>
  );
}
