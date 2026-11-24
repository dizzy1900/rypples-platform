/**
 * pnpm precompute — regenerate data/precomputed/ with a real API key (docs/07-ai.md §5).
 * Runs each flow's live path directly (no HTTP, no budget gate) on a throwaway in-memory session.
 * Outputs are marked `authored: false`. F2 files are `reviewed: false` and are never shown until a
 * person reads them and sets `reviewed: true`. Re-read every regenerated file before committing.
 *
 *   pnpm precompute                         # F1, F3, F4, F5, F6, F7
 *   pnpm precompute --only f1,f3            # selected flows
 *   pnpm precompute --only f2 --f2 "Saildrone" --f2 "https://www.notpla.com"
 *   pnpm precompute --only f2 --portfolio   # F2 for the public portfolio companies
 */
import fs from "node:fs";
import path from "node:path";
import { arg, flag, loadEnv, requireKey, spendLedger } from "./ai-env";

const OUT = path.join(process.cwd(), "data", "precomputed");

function write(name: string, data: unknown) {
  const file = path.join(OUT, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  wrote data/precomputed/${name}`);
}
const readPre = (name: string) => JSON.parse(fs.readFileSync(path.join(OUT, name), "utf8"));
const allArgs = (name: string) => process.argv.flatMap((a, i) => (a === `--${name}` && process.argv[i + 1] ? [process.argv[i + 1]!] : []));
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Ev = { type: string; id?: string; data?: unknown };

async function main() {
  loadEnv();
  requireKey("precompute");
  process.env.LIVE_AI = "on";
  const ledger = await spendLedger("precompute");
  console.log(`Total AI spend so far: $${(await ledger.guard()).toFixed(2)} of $${ledger.cap}.`);

  const { ulid } = await import("ulid");
  const { newTracker, modelFor } = await import("@/lib/ai/client");
  const { getSeedState } = await import("@/lib/data");
  const { diagnosticFlow } = await import("@/lib/ai/flows/diagnostic");
  const { anyCompanyFlow } = await import("@/lib/ai/flows/any-company");
  const { captainFlow } = await import("@/lib/ai/flows/captain");
  const { lessonMatchFlow } = await import("@/lib/ai/flows/lesson-match");
  const { boardPackFlow } = await import("@/lib/ai/flows/board-pack");
  const { shareholderUpdateFlow } = await import("@/lib/ai/flows/shareholder-update");
  const { dayOneFlow } = await import("@/lib/ai/flows/day-one");
  type AnyDef = { flow: Parameters<typeof newTracker>[0]; input: { parse: (x: unknown) => unknown }; live: (run: never) => AsyncGenerator<Ev> };

  let total = 0;
  async function runLive(def: AnyDef, rawInput: unknown, sessionId = `precompute-${ulid()}`) {
    await ledger.guard();
    const run = {
      flow: def.flow,
      input: def.input.parse(rawInput),
      sessionId,
      priority: true,
      ipHash: null,
      runId: `run_${ulid()}`,
      tracker: newTracker(def.flow, true),
      signal: new AbortController().signal,
      decision: { mode: "live" as const, soft: false, viaPriority: true },
      meta: { promptVersion: null as string | null, precomputed: false, capture: undefined as Record<string, unknown> | undefined },
    };
    const events: Ev[] = [];
    let result: { id: string; data: unknown } | null = null;
    for await (const e of def.live(run as never)) {
      if (e.type === "result") result = { id: e.id!, data: e.data };
      else if (e.type === "error") throw new Error(`${def.flow}: ${JSON.stringify(e)}`);
      else events.push(e);
    }
    total += run.tracker.cost_usd;
    await ledger.record(def.flow, run.tracker.cost_usd, run.tracker.models);
    console.log(`  ${def.flow}: ${run.tracker.calls} calls, ${run.tracker.searches} searches, $${run.tracker.cost_usd.toFixed(4)}`);
    if (!result) throw new Error(`${def.flow} returned no result`);
    return { run, events, result };
  }
  const header = (promptVersion: string | null, model: string, reviewed = true) => ({
    authored: false,
    model,
    reviewed,
    prompt_version: promptVersion,
    generated_at: new Date().toISOString(),
  });

  const only = (arg("only") ?? "f1,f3,f4,f5,f6,f7").split(",").map((x) => x.trim().toLowerCase());
  const s = getSeedState();

  if (only.includes("f1")) {
    console.log("F1 Desolenator");
    const { run, events, result } = await runLive(diagnosticFlow as unknown as AnyDef, { companyId: "desolenator" });
    const d = result.data as Record<string, unknown>;
    write("f1-desolenator.json", {
      ...header(run.meta.promptVersion, modelFor("f1-synthesis")),
      company_id: "desolenator",
      events,
      result: { company_id: d.company_id, scores: d.scores, evidence: d.evidence, synthesis: d.synthesis },
    });
  }

  if (only.includes("f2")) {
    const queries = [...allArgs("f2"), ...(flag("portfolio") ? s.companies.filter((c) => c.public && c.website).map((c) => c.website!) : [])];
    if (!queries.length) console.log("F2: pass --f2 <name or URL> (repeatable) or --portfolio");
    for (const q of queries) {
      console.log(`F2 ${q}`);
      const { run, result } = await runLive(anyCompanyFlow as unknown as AnyDef, { query: q, runAgain: true });
      const r = result.data as { identity?: { name?: string | null } | null };
      const slug = slugify(r.identity?.name || q.replace(/^https?:\/\/(www\.)?/, ""));
      write(`f2/${slug}.json`, { ...header(run.meta.promptVersion, modelFor("f2-synthesis"), false), ...(r as object), reviewed: false });
    }
  }

  if (only.includes("f3")) {
    console.log("F3 Captain");
    const current = readPre("f3-captain.json") as {
      seeded: unknown;
      prompts: unknown;
      answers: { id: string; scope: "os" | "bridge"; prompt: string; match: string[][] }[];
    };
    const answers = [];
    for (const a of current.answers) {
      const scope = a.scope === "bridge" ? { kind: "bridge", slug: "desolenator" } : { kind: "os" };
      const { run, result } = await runLive(captainFlow as unknown as AnyDef, { message: a.prompt, scope });
      const cap = (run.meta.capture ?? {}) as { rawText?: string; tools?: unknown[] };
      const ans = result.data as { caveats?: string[]; untraced?: string[]; next_steps?: { title: string; detail: string; target: string | null }[] };
      if (ans.untraced?.length) console.warn(`  ! untraced numbers in "${a.prompt}": ${ans.untraced.join(", ")}`);
      answers.push({
        ...a,
        tools: cap.tools ?? [],
        text: cap.rawText ?? "",
        caveats: ans.caveats ?? [],
        next_steps: (ans.next_steps ?? []).map(({ title, detail, target }) => ({ title, detail, target })),
      });
    }
    write("f3-captain.json", { ...header("captain@v1", modelFor("f3")), seeded: current.seeded, prompts: current.prompts, answers });
  }

  if (only.includes("f4")) {
    console.log("F4 WSense");
    const { run, result } = await runLive(lessonMatchFlow as unknown as AnyDef, { lessonId: "wsense-strategic" });
    write("f4-wsense.json", { ...header(run.meta.promptVersion, modelFor("f4")), result: result.data });
  }

  if (only.includes("f5")) {
    console.log("F5 Desolenator");
    const sid = `precompute-${ulid()}`;
    const letter = await runLive(boardPackFlow as unknown as AnyDef, { companyId: "desolenator", sectionKey: "letter" }, sid);
    const asks = await runLive(boardPackFlow as unknown as AnyDef, { companyId: "desolenator", sectionKey: "asks" }, sid);
    const md = (r: typeof letter) => (r.result.data as { content_md: string }).content_md;
    write("f5-desolenator.json", {
      ...header(letter.run.meta.promptVersion, modelFor("f5")),
      company_id: "desolenator",
      sections: { letter: md(letter), asks: md(asks) },
    });
  }

  if (only.includes("f6")) {
    console.log("F6 Q4 2026");
    const { run, result } = await runLive(shareholderUpdateFlow as unknown as AnyDef, { quarter: "Q4 2026" });
    const d = result.data as Record<string, unknown>;
    write("f6-q4.json", { ...header(run.meta.promptVersion, modelFor("f6")), ...d, draft_n: 1 });
  }

  if (only.includes("f7")) {
    console.log("F7 Tern");
    const { run } = await runLive(dayOneFlow as unknown as AnyDef, { dealId: "tern" });
    const plan = run.meta.capture?.plan;
    if (!plan) throw new Error("F7 live run did not capture a plan");
    write("f7-tern.json", { ...header(run.meta.promptVersion, modelFor("f7")), deal_id: "tern", plan });
  }

  console.log(`\nEstimated cost: $${total.toFixed(4)}. overnight.json is authored by hand and is not regenerated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
