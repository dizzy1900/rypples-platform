/**
 * Server-tool turns (web search, web fetch) run in a loop on Anthropic's side. When that loop hits
 * its iteration limit the response ends with `stop_reason: "pause_turn"`, often before the model has
 * written its cited findings. Resuming means re-sending the conversation with the paused assistant
 * content appended (no extra user message); the server picks up where it stopped.
 */
import type { BetaContentBlock, BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

export const MAX_CONTINUATIONS = 4;

export type ContinuedTurn = {
  /** Every content block from every round, in order. */
  content: BetaContentBlock[];
  /** The stop reason of each round, in order (the last is the turn's final stop reason). */
  stops: (string | null)[];
  /** Names of client tool calls the model made although only server tools were offered. */
  strays: string[];
};

export const STRAY_TOOL_RESULT =
  "That tool is not available. Only web_search and web_fetch exist here. Use them if you need more, then write your cited findings.";

export async function continuePausedTurn(
  call: (messages: BetaMessageParam[]) => Promise<BetaMessage>,
  messages: BetaMessageParam[],
  maxContinuations = MAX_CONTINUATIONS,
): Promise<ContinuedTurn> {
  const content: BetaContentBlock[] = [];
  const stops: (string | null)[] = [];
  const strays: string[] = [];
  let base = messages; // history up to the current assistant turn
  let pending: BetaContentBlock[] = []; // the current assistant turn so far
  const assistant = (blocks: BetaContentBlock[]) => ({ role: "assistant", content: [...blocks] }) as unknown as BetaMessageParam;
  for (let round = 0; round <= maxContinuations; round++) {
    const msg = await call(pending.length ? [...base, assistant(pending)] : base);
    const blocks = msg.content as BetaContentBlock[];
    content.push(...blocks);
    pending.push(...blocks);
    stops.push(msg.stop_reason ?? null);
    if (msg.stop_reason === "pause_turn") continue; // resume: the paused turn is sent back as the last message
    const calls = blocks.filter((b): b is Extract<BetaContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    if (msg.stop_reason !== "tool_use" || !calls.length) break;
    // A client tool call with no client tools offered: answer it with an error and let the model carry on.
    strays.push(...calls.map((c) => c.name));
    base = [
      ...base,
      assistant(pending),
      { role: "user", content: calls.map((c) => ({ type: "tool_result" as const, tool_use_id: c.id, content: STRAY_TOOL_RESULT, is_error: true })) },
    ];
    pending = [];
  }
  return { content, stops, strays };
}

/** Block-type counts for a log line (e.g. `text:12 text+cite:9 web_search_tool_result:5`). */
export function blockSummary(content: BetaContentBlock[]): string {
  const counts = new Map<string, number>();
  for (const b of content) {
    const key = b.type === "text" && b.citations?.length ? "text+cite" : b.type;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([k, n]) => `${k}:${n}`).join(" ");
}
