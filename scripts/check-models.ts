/**
 * pnpm check:models — list the models available to this key and check every configured model
 * (MODEL_FAST / MODEL_MAIN / MODEL_DEEP) exists, supports structured outputs and citations, and,
 * where F2 needs it, server-side web search. Also checks each configured model is priced.
 */
import { loadEnv, requireKey } from "./ai-env";

async function main() {
  loadEnv();
  requireKey("check:models");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { env } = await import("@/lib/env");
  const { configuredModels, modelFor } = await import("@/lib/ai/client");
  const { priceFor } = await import("@/config/pricing");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const available = new Map<string, Awaited<ReturnType<typeof client.models.retrieve>>>();
  for await (const m of client.models.list({ limit: 100 })) available.set(m.id, m);
  console.log(`Available models (${available.size}):`);
  for (const m of available.values()) console.log(`  ${m.id}  ${m.display_name}`);
  const e = env();
  console.log(`\nConfigured: MODEL_FAST=${e.MODEL_FAST} MODEL_MAIN=${e.MODEL_MAIN} MODEL_DEEP=${e.MODEL_DEEP || "(empty → MODEL_MAIN)"}`);
  const webSearchNeeded = new Set([modelFor("f2-relevance"), modelFor("f2-research")]);
  let ok = true;
  for (const id of configuredModels()) {
    const m = available.get(id);
    const problems: string[] = [];
    if (!m) problems.push("not available to this key");
    const cap = m?.capabilities;
    if (cap) {
      if (!cap.structured_outputs.supported) problems.push("no structured outputs");
      if (!cap.citations.supported) problems.push("no citations");
      if (webSearchNeeded.has(id) && !cap.server_tools.web_search.supported) problems.push("no web search (F2 needs it)");
    }
    if (!priceFor(id)) problems.push("not in config/pricing.ts");
    if (/fable-5-2/.test(id)) problems.push("claude-fable-5-2 must not be used");
    console.log(`  ${problems.length ? "✗" : "✓"} ${id}${problems.length ? `: ${problems.join("; ")}` : ""}`);
    if (problems.length) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
