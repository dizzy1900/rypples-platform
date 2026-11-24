/**
 * pnpm evals — golden-case evals for F1–F7 (docs/11-testing-and-evals.md §4).
 *
 *   pnpm evals                     # live: runs every flow's live path (needs ANTHROPIC_API_KEY; costs money)
 *   pnpm evals --only f3,f5        # selected flows
 *   pnpm evals --offline           # no key: asserts against the cached/replay paths and data/precomputed/
 *   pnpm evals --offline --judge   # offline outputs, but still ask the judge (needs a key)
 *   pnpm evals --no-judge          # live outputs, skip the judge calls
 *
 * Each case runs on a fresh in-memory session. Judges (MODEL_MAIN, lib/ai/prompts/judge) are used only for
 * tone and uncited-claim checks. The report (pass rates, failures with excerpts, cost) is written to
 * evals/reports/<timestamp>-<live|offline>.{json,md}. Exit code 1 when any case fails.
 */
import fs from "node:fs";
import path from "node:path";
import { arg, flag, loadEnv, requireKey, spendLedger } from "./ai-env";

type Ev = { type: string; id?: string; data?: unknown; message?: string };
type Check = { name: string; pass: boolean | null; detail?: string };
type CaseReport = { flow: string; id: string; group?: string; status: "pass" | "fail" | "skip"; checks: Check[]; excerpt?: string; cost_usd: number };
type GoldenCase = { id: string; group?: string; note?: string; todo?: string; input: Record<string, unknown> | null; expect: Record<string, unknown> };
type Golden = { flow: string; prompt: string; cases: GoldenCase[]; fixtures?: { fixture: string; expect: Record<string, unknown> }[] };

const ROOT = process.cwd();
const readGolden = (flow: string): Golden => JSON.parse(fs.readFileSync(path.join(ROOT, "evals", `${flow}.json`), "utf8"));
const check = (name: string, pass: boolean | null, detail?: string): Check => ({ name, pass, ...(detail ? { detail } : {}) });
const clip = (s: string, n = 280) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function main() {
  loadEnv();
  const offline = flag("offline");
  const useJudge = !flag("no-judge") && (!offline || flag("judge"));
  if (!offline || useJudge) requireKey(offline ? "evals --judge" : "evals (or pass --offline)");
  process.env.LIVE_AI = offline ? "off" : "on";
  const ledger = !offline || useJudge ? await spendLedger("evals") : null;
  if (ledger) console.log(`Total AI spend so far: $${(await ledger.guard()).toFixed(2)} of $${ledger.cap}.`);

  const { ulid } = await import("ulid");
  const { newTracker, structuredCall, plain } = await import("@/lib/ai/client");
  const { section } = await import("@/lib/ai/prompts");
  const { getSeedState, getState } = await import("@/lib/data");
  const { resolveRef } = await import("@/lib/data/projections/refs");
  const { openConstraint } = await import("@/lib/domain/portfolio-stats");
  const { INTENTS } = await import("@/lib/domain/program-map");
  const G = await import("@/lib/ai/guardrails");
  const { JudgeVerdict, JudgeJson } = await import("@/lib/ai/schemas/judge");
  const { reasonCitesFact } = await import("@/lib/ai/schemas/lesson-match");
  const { runTool } = await import("@/lib/tools/registry");
  const { reviewedF2, f2Fixture, precomputed } = await import("@/lib/ai/precomputed");
  const { diagnosticFlow } = await import("@/lib/ai/flows/diagnostic");
  const { anyCompanyFlow } = await import("@/lib/ai/flows/any-company");
  const { captainFlow, resolveViewer } = await import("@/lib/ai/flows/captain");
  const { lessonMatchFlow, eligibleFor, companyFacts } = await import("@/lib/ai/flows/lesson-match");
  const { boardPackFlow, boardPackContext } = await import("@/lib/ai/flows/board-pack");
  const { shareholderUpdateFlow } = await import("@/lib/ai/flows/shareholder-update");
  const { dayOneFlow } = await import("@/lib/ai/flows/day-one");
  type T = import("@/lib/ai/types").DiagnosticResult;
  type F2 = import("@/lib/ai/types").AnyCompanyResult;
  type Ans = import("@/lib/ai/types").CaptainAnswer;
  type F4 = import("@/lib/ai/types").LessonMatchResult;
  type F5 = import("@/lib/ai/types").BoardPackDraft;
  type F6 = import("@/lib/ai/types").ShareholderDraft;
  type F7 = import("@/lib/ai/types").DayOneResult;
  type AnyDef = {
    flow: Parameters<typeof newTracker>[0];
    input: { parse: (x: unknown) => unknown };
    live: (run: never) => AsyncGenerator<Ev>;
    cached: (run: never, reason: "disabled") => AsyncGenerator<Ev>;
  };

  let judgeCost = 0;
  let flowCost = 0;
  const seed = getSeedState();

  async function run(def: AnyDef, rawInput: unknown) {
    if (!offline) await ledger?.guard();
    const r = {
      flow: def.flow,
      input: def.input.parse(rawInput),
      sessionId: `evals-${ulid()}`,
      priority: true,
      ipHash: null,
      runId: `run_${ulid()}`,
      tracker: newTracker(def.flow, true),
      signal: new AbortController().signal,
      decision: offline ? { mode: "cached" as const, reason: "disabled" as const, soft: false, viaPriority: false } : { mode: "live" as const, soft: false, viaPriority: true },
      meta: { promptVersion: null as string | null, precomputed: false, capture: undefined as Record<string, unknown> | undefined },
    };
    const gen = offline ? def.cached(r as never, "disabled") : def.live(r as never);
    let result: unknown = null;
    let failure: string | null = null;
    for await (const e of gen) {
      if (e.type === "result") result = e.data;
      if (e.type === "error" || e.type === "fallback") failure = `${e.type}: ${e.message ?? ""}`;
    }
    flowCost += r.tracker.cost_usd;
    await ledger?.record(def.flow, r.tracker.cost_usd, r.tracker.models);
    return { run: r, result, failure };
  }

  async function judge(text: string, evidence: string): Promise<Check> {
    if (!useJudge) return check("judge", null, "judge skipped");
    await ledger?.guard();
    const t = newTracker("diagnostic", true);
    try {
      const v = await structuredCall(t, {
        task: "judge",
        system: [plain(section("judge", "judge"))],
        messages: [{ role: "user", content: `Evidence:\n${evidence || "(none)"}\n\nText to review:\n${text}` }],
        max_tokens: 800,
        schema: JudgeVerdict,
        jsonSchema: JudgeJson,
      });
      return check("judge", v.pass, v.pass ? undefined : v.issues.join("; "));
    } catch (err) {
      return check("judge", false, `judge call failed: ${(err as Error).message}`);
    } finally {
      judgeCost += t.cost_usd;
      await ledger?.record("evals-judge", t.cost_usd, t.models);
    }
  }

  const tone = (text: string) => {
    const i = G.toneIssues(text);
    return check("tone", i.length === 0, i.join("; "));
  };
  const evidenceText = (ev: { id: string; claim: string; cited_text: string }[]) => ev.map((e) => `[${e.id}] ${e.claim} — "${e.cited_text}"`).join("\n");

  // ── per-flow assertions ────────────────────────────────────────────────
  async function f1(c: GoldenCase): Promise<Check[]> {
    const { result, failure } = await run(diagnosticFlow as unknown as AnyDef, c.input);
    if (!result) return [check("result", false, failure ?? "no result")];
    const d = result as T;
    const ev = new Map(d.evidence.map((e) => [e.id, e]));
    const out: Check[] = [];
    const bad = d.scores.filter((s) => s.score != null && !s.evidence_ids.some((id) => ev.has(id))).map((s) => s.domain);
    out.push(check("non-null scores cite valid evidence", bad.length === 0, bad.join(", ")));
    const spanIssues: string[] = [];
    for (const e of d.evidence) {
      if (!e.location) {
        if (!e.url) spanIssues.push(`${e.id}: no span or url`);
        continue;
      }
      const f = path.join(ROOT, "data", "sources", `${e.location.source_id}.md`);
      if (!fs.existsSync(f)) spanIssues.push(`${e.id}: missing snapshot ${e.location.source_id}`);
      else if (e.location.end > fs.readFileSync(f, "utf8").length || e.location.start >= e.location.end) spanIssues.push(`${e.id}: span out of range`);
    }
    out.push(check("evidence resolves to snapshot spans", spanIssues.length === 0, spanIssues.join("; ")));
    out.push(check("binding domain", d.synthesis.binding_domain === c.expect.binding_domain, `got ${d.synthesis.binding_domain}`));
    for (const dom of (c.expect.null_domains as string[]) ?? []) {
      const s = d.scores.find((x) => x.domain === dom);
      out.push(check(`${dom} is null`, !!s && s.score === null, `got ${s?.score}`));
    }
    out.push(check("question count", d.synthesis.questions.length === c.expect.questions, `got ${d.synthesis.questions.length}`));
    const prose = [...d.scores.map((s) => s.finding), d.synthesis.rationale, ...d.synthesis.questions].join("\n");
    out.push(tone(prose));
    if (c.expect.judge) out.push(await judge(prose, evidenceText(d.evidence)));
    return out;
  }

  function f2Checks(d: F2, expectStatus: string): Check[] {
    const out: Check[] = [];
    const okish = expectStatus === "ok" ? ["ok", "insufficient"].includes(d.status) : d.status === expectStatus;
    out.push(check("status", okish, `expected ${expectStatus}, got ${d.status}`));
    if (d.status === "insufficient") out.push(check("no binding when insufficient", !d.synthesis?.binding_domain, `got ${d.synthesis?.binding_domain}`));
    if (d.status === "ok" || d.status === "insufficient") {
      const scored = d.scores.filter((s) => s.score != null);
      const two = scored.filter((s) => s.evidence_ids.length >= 2).length;
      if (d.status === "ok") out.push(check("≥80% of scored domains carry ≥2 evidence", scored.length === 0 || two / scored.length >= 0.8, `${two}/${scored.length}`));
      const prose = [d.identity.description, ...d.scores.map((s) => s.finding), d.synthesis?.rationale ?? ""].join("\n");
      const evid = d.evidence.map((e) => `${e.claim} ${e.cited_text}`).join(" ").toLowerCase();
      const spec = [...new Set(G.financialSpeculation(prose).map((x) => x.toLowerCase()))].filter((w) => !evid.includes(w));
      out.push(check("no financial speculation (regex)", spec.length === 0, spec.join(", ")));
      out.push(tone(prose));
    }
    return out;
  }
  async function f2(c: GoldenCase): Promise<Check[]> {
    if (!c.input) return [check("case", null, c.todo ?? "no input")];
    const expectStatus = String(c.expect.status);
    if (offline) {
      const q = String(c.input.query);
      const key = q.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "").replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9]+/g, "-");
      const file = await reviewedF2([key, c.id]);
      if (!file) return [check("reviewed precomputed file", null, `no reviewed data/precomputed/f2 file for ${c.id}`)];
      return f2Checks(file, expectStatus);
    }
    const { result, failure } = await run(anyCompanyFlow as unknown as AnyDef, { ...c.input, runAgain: true });
    if (!result) return [check("result", false, failure ?? "no result")];
    const d = result as F2;
    const out = f2Checks(d, expectStatus);
    if ((d.status === "ok" || d.status === "insufficient") && d.scores.length) {
      const prose = [d.identity.description, ...d.scores.map((s) => s.finding), d.synthesis?.rationale ?? ""].join("\n");
      out.push(await judge(prose, evidenceText(d.evidence)));
    }
    return out;
  }

  async function f3(c: GoldenCase): Promise<Check[]> {
    const { run: r, result, failure } = await run(captainFlow as unknown as AnyDef, c.input);
    if (!result) return [check("result", false, failure ?? "no result")];
    const a = result as Ans;
    const out: Check[] = [check("zero untraced numbers", a.untraced.length === 0, a.untraced.join(", "))];
    const scope = (c.input as { scope: import("@/lib/ai/types").CaptainScopeInput }).scope;
    if (c.expect.factual) {
      if (a.paused) out.push(check("≥1 ref", null, "paused: no cached answer for this question"));
      else out.push(check("≥1 ref", a.refs.length > 0, `${a.refs.length} refs`));
    }
    // low-confidence caveat: re-run the answer's tool calls and look for a low-confidence result
    const calls = offline
      ? (precomputed.f3.answers.find((x) => x.prompt === (c.input as { message: string }).message)?.tools ?? [])
      : (((r.meta.capture as { tools?: { name: string; input: unknown }[] } | undefined)?.tools) ?? []);
    if (!a.paused && calls.length) {
      const s = await getState(r.sessionId);
      const vi = resolveViewer(s, scope);
      let low = false;
      for (const t of calls) {
        try {
          const res = await runTool(t.name, { viewer: vi.viewer, sessionId: r.sessionId }, t.input);
          if (JSON.stringify(res.data).includes('"confidence":"low"')) low = true;
        } catch {
          /* a refused call is fine here */
        }
      }
      if (low) out.push(check("low-confidence caveat present", a.caveats.length > 0 || /low confidence/i.test(a.text), a.caveats.join("; ")));
    }
    if (c.expect.no_leak) {
      const slug = String(c.expect.no_leak);
      const leakedRefs = a.refs.filter((x) => x.id === slug || x.id.startsWith(`${slug}/`) || x.id.endsWith(`/${slug}`) || x.href?.includes(`/${slug}`));
      const k = openConstraint(seed, slug);
      const leakedText = k && a.text.toLowerCase().includes(k.statement.toLowerCase());
      out.push(check("founder probe refused without leaking", leakedRefs.length === 0 && !leakedText, [...leakedRefs.map((x) => `${x.type}/${x.id}`), leakedText ? "constraint statement in text" : ""].filter(Boolean).join(", ")));
    }
    if (a.text) out.push(tone(a.text));
    return out;
  }

  async function f4(c: GoldenCase): Promise<Check[]> {
    const { result, failure } = await run(lessonMatchFlow as unknown as AnyDef, c.input);
    if (!result) return [check("result", false, failure ?? "no result")];
    const d = result as F4;
    const el = eligibleFor(seed, String(c.input!.lessonId))!;
    const want = new Set(el.companies.map((x) => x.id));
    const got = new Set([...d.matches, ...d.excluded].map((x) => x.company_id));
    const missing = [...want].filter((x) => !got.has(x));
    const extra = [...got].filter((x) => !want.has(x));
    return [
      check("exactly the eligible set considered", !missing.length && !extra.length, [missing.length ? `missing ${missing.join(", ")}` : "", extra.length ? `extra ${extra.join(", ")}` : ""].filter(Boolean).join("; ")),
      check(
        "reasons cite a company fact",
        d.matches.every((m) => reasonCitesFact(m.reason, companyFacts(seed, m.company_id))),
        d.matches.filter((m) => !reasonCitesFact(m.reason, companyFacts(seed, m.company_id))).map((m) => m.company_id).join(", "),
      ),
      check("no exited or source company matched", !d.matches.some((m) => !want.has(m.company_id) || ((c.expect.never as string[]) ?? []).includes(m.company_id))),
      tone(d.matches.map((m) => m.reason).join("\n")),
    ];
  }

  async function f5(c: GoldenCase): Promise<Check[]> {
    const { result, failure } = await run(boardPackFlow as unknown as AnyDef, c.input);
    if (!result) return [check("result", false, failure ?? "no result")];
    const text = (result as F5).content_md;
    const ctx = boardPackContext(seed, String(c.input!.companyId)).text;
    const removed = G.stripUngroundedFinancials(text, ctx).removed;
    const words = G.wordCount(text);
    const out = [
      check("no ungrounded currency or percentages", removed.length === 0, removed.join(", ")),
      check(`≤${c.expect.max_words} words`, words <= Number(c.expect.max_words), `${words} words`),
      check("first person", G.isFirstPerson(text)),
      tone(text),
    ];
    if (c.expect.judge) out.push(await judge(text, ctx));
    return out.map((x) => ({ ...x, ...(x.pass === false && !x.detail ? { detail: clip(text) } : {}) }));
  }

  async function f6(c: GoldenCase): Promise<Check[]> {
    const { result, failure } = await run(shareholderUpdateFlow as unknown as AnyDef, c.input);
    if (!result) return [check("result", false, failure ?? "no result")];
    const d = result as F6;
    const unresolved = d.segments.filter((s) => s.kind === "ref" && !resolveRef(seed, s.ref)).map((s) => (s.kind === "ref" ? `${s.ref.type}/${s.ref.id}/${s.ref.field}` : ""));
    const text = d.segments.map((s) => (s.kind === "text" ? s.text : "[ref]")).join("");
    const digits = G.textDigitViolations(d.segments.map((s) => (s.kind === "text" ? s.text : " ")).join(" "));
    const out = [
      check("all refs resolve", unresolved.length === 0, unresolved.join(", ")),
      check("no digits in text segments", digits.length === 0, digits.join(", ")),
      check("held-back records listed", d.held_back.length > 0 && d.held_back.every((h) => !!h.reason), `${d.held_back.length} held back`),
      tone(text),
    ];
    if (c.expect.judge) out.push(await judge(text, "Figures are rendered from platform records at each [ref]."));
    return out;
  }

  async function f7(c: GoldenCase): Promise<Check[]> {
    const { result, failure } = await run(dayOneFlow as unknown as AnyDef, c.input);
    if (!result) return [check("result", false, failure ?? "no result")];
    const d = result as F7;
    const e = c.expect as { binding_domain: string; priorities: number; started: string[]; deferred: string[]; hours_started: number; partner_seats: [number, number] };
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    return [
      check("binding domain", d.binding.domain === e.binding_domain, `got ${d.binding.domain}`),
      check("priorities with valid intents", d.priorities.length === e.priorities && d.priorities.every((p) => (INTENTS as readonly string[]).includes(p.intent)), `${d.priorities.length} priorities`),
      check("started programs", same(d.started.map((x) => x.program_id), e.started), d.started.map((x) => x.program_id).join(", ")),
      check("deferred programs", same(d.deferred.map((x) => x.program_id), e.deferred), d.deferred.map((x) => x.program_id).join(", ")),
      check("hours started", d.hours_started === e.hours_started, `got ${d.hours_started}`),
      check("board partner seats", !!d.partner && d.partner.seats_used === e.partner_seats[0] && d.partner.seats_total === e.partner_seats[1], d.partner ? `${d.partner.seats_used} of ${d.partner.seats_total}` : "no partner"),
    ];
  }

  const RUNNERS: Record<string, (c: GoldenCase) => Promise<Check[]>> = { f1, f2, f3, f4, f5, f6, f7 };
  const only = (arg("only") ?? "f1,f2,f3,f4,f5,f6,f7").split(",").map((x) => x.trim().toLowerCase());
  const reports: CaseReport[] = [];

  for (const flow of only) {
    const g = readGolden(flow);
    console.log(`\n${flow.toUpperCase()} (${g.prompt})`);
    if (flow === "f2" && g.fixtures) {
      for (const fx of g.fixtures) {
        const d = await f2Fixture(fx.fixture as Parameters<typeof f2Fixture>[0]).catch(() => null);
        const res = d?.result;
        const checks = res ? f2Checks(res, String(fx.expect.status)) : [check("fixture", false, "missing fixture")];
        const status = checks.some((x) => x.pass === false) ? "fail" : "pass";
        reports.push({ flow, id: `fixture:${fx.fixture}`, group: "fixture", status, checks, cost_usd: 0 });
        console.log(`  ${status === "pass" ? "pass" : "FAIL"}  fixture:${fx.fixture}`);
      }
    }
    for (const c of g.cases) {
      const before = judgeCost + flowCost;
      let checks: Check[];
      const t0 = Date.now();
      try {
        checks = await RUNNERS[flow]!(c);
      } catch (err) {
        checks = [check("run", false, (err as Error).message)];
      }
      const status: CaseReport["status"] = checks.some((x) => x.pass === false) ? "fail" : checks.every((x) => x.pass === null) ? "skip" : "pass";
      const failed = checks.filter((x) => x.pass === false);
      reports.push({ flow, id: c.id, group: c.group, status, checks, excerpt: failed.map((x) => `${x.name}: ${x.detail ?? ""}`).join(" | ") || undefined, cost_usd: judgeCost + flowCost - before });
      console.log(`  ${status === "pass" ? "pass" : status === "skip" ? "skip" : "FAIL"}  ${c.id} (${((Date.now() - t0) / 1000).toFixed(1)}s)${failed.length ? ` — ${clip(failed.map((x) => `${x.name}: ${x.detail ?? ""}`).join("; "), 200)}` : ""}`);
    }
  }

  const by = (flow: string) => reports.filter((r) => r.flow === flow);
  const summary = only.map((flow) => {
    const rs = by(flow);
    const ran = rs.filter((r) => r.status !== "skip");
    return { flow, cases: rs.length, ran: ran.length, passed: ran.filter((r) => r.status === "pass").length, skipped: rs.length - ran.length };
  });
  const totalCost = flowCost + judgeCost;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const mode = offline ? "offline" : "live";
  const dir = path.join(ROOT, "evals", "reports");
  fs.mkdirSync(dir, { recursive: true });
  const report = { mode, generated_at: new Date().toISOString(), judge: useJudge, cost_usd: { flows: flowCost, judge: judgeCost, total: totalCost }, summary, cases: reports };
  fs.writeFileSync(path.join(dir, `${stamp}-${mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    `# Evals · ${mode} · ${report.generated_at}`,
    "",
    `Judge: ${useJudge ? "on" : "off"} · Cost: $${totalCost.toFixed(4)} (flows $${flowCost.toFixed(4)}, judge $${judgeCost.toFixed(4)})`,
    "",
    "| Flow | Cases | Ran | Passed | Skipped | Pass rate |",
    "|---|---|---|---|---|---|",
    ...summary.map((s) => `| ${s.flow} | ${s.cases} | ${s.ran} | ${s.passed} | ${s.skipped} | ${s.ran ? Math.round((s.passed / s.ran) * 100) : 0}% |`),
    "",
    "## Failures",
    "",
    ...(reports.filter((r) => r.status === "fail").map((r) => `- **${r.flow} · ${r.id}**: ${clip(r.excerpt ?? "", 600)}`) || []),
    ...(reports.some((r) => r.status === "fail") ? [] : ["None."]),
    "",
    "## Skipped",
    "",
    ...reports.filter((r) => r.status === "skip").map((r) => `- ${r.flow} · ${r.id}: ${r.checks.map((c) => c.detail).filter(Boolean).join("; ")}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, `${stamp}-${mode}.md`), md);
  console.log(`\n${summary.map((s) => `${s.flow} ${s.passed}/${s.ran}${s.skipped ? ` (${s.skipped} skipped)` : ""}`).join(" · ")}`);
  console.log(`Cost $${totalCost.toFixed(4)} · report evals/reports/${stamp}-${mode}.md`);
  process.exit(reports.some((r) => r.status === "fail") ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
