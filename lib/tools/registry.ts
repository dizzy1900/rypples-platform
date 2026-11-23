/**
 * The tool registry (docs/08-mcp-and-integrations.md §1). Captain filters it by viewer scope;
 * the MCP route registers the public read-only subset.
 */
import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { AnyViewer } from "@/lib/viewer";
import { toStrictJsonSchema, nullsToUndefined } from "@/lib/ai/schemas/common";
import type { ToolCtx, ToolDef, ToolResult, ToolScope } from "./types";
import { listPortfolio } from "./list-portfolio";
import { portfolioStatsTool } from "./portfolio-stats";
import { getCompany } from "./get-company";
import { getDiagnostic } from "./get-diagnostic";
import { getBenchmarks } from "./get-benchmarks";
import { searchPlaybook } from "./search-playbook";
import { getLesson } from "./get-lesson";
import { getGrowthEngine } from "./get-growth-engine";
import { getAllocation } from "./get-allocation";
import { getLedger } from "./get-ledger";
import { listPipeline } from "./list-pipeline";
import { getMarketEvidence } from "./get-market-evidence";
import { getImpact } from "./get-impact";
import { getStrategicPaths } from "./get-strategic-paths";
import { listDecisions } from "./list-decisions";
import { getBoardPackStatus } from "./get-board-pack-status";
import { proposeNextStep } from "./propose-next-step";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ToolDef<any, any>;

export const TOOLS: AnyTool[] = [
  listPortfolio,
  portfolioStatsTool,
  getCompany,
  getDiagnostic,
  getBenchmarks,
  searchPlaybook,
  getLesson,
  getGrowthEngine,
  getAllocation,
  getLedger,
  listPipeline,
  getMarketEvidence,
  getImpact,
  getStrategicPaths,
  listDecisions,
  getBoardPackStatus,
  proposeNextStep,
];

export const getTool = (name: string) => TOOLS.find((t) => t.name === name) ?? null;

export const scopeOf = (v: AnyViewer): ToolScope => (v.kind === "rypples" ? "rypples" : v.kind === "founder" ? "founder" : "public");

export function toolsFor(v: AnyViewer): AnyTool[] {
  const k = scopeOf(v);
  return TOOLS.filter((t) => t.scopes.includes(k) && (k !== "public" || t.readOnly));
}

/** Public read-only tools for MCP and /connect. */
export const publicTools = () => TOOLS.filter((t) => t.scopes.includes("public") && t.readOnly);

/** Anthropic client-tool definitions (strict) for Captain. */
export function toAnthropicTools(v: AnyViewer): BetaTool[] {
  return toolsFor(v).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: toStrictJsonSchema(t.input) as BetaTool["input_schema"],
    strict: true,
  }));
}

/** Validate input and run a tool; strict tools send null for omitted optional keys. */
export async function runTool(name: string, ctx: ToolCtx, rawInput: unknown): Promise<ToolResult<unknown>> {
  const t = getTool(name);
  if (!t) throw new Error(`Unknown tool ${name}`);
  const parsed = t.input.safeParse(nullsToUndefined(rawInput ?? {}));
  if (!parsed.success) throw new Error(`Invalid input for ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  return t.handler(ctx, parsed.data);
}

/** Tool metadata for /connect. */
export const toolMeta = () => publicTools().map((t) => ({ name: t.name, title: t.title, description: t.description }));
