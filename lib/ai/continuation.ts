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
};

export async function continuePausedTurn(
  call: (messages: BetaMessageParam[]) => Promise<BetaMessage>,
  messages: BetaMessageParam[],
  maxContinuations = MAX_CONTINUATIONS,
): Promise<ContinuedTurn> {
  const content: BetaContentBlock[] = [];
  const stops: (string | null)[] = [];
  let history = messages;
  for (let round = 0; round <= maxContinuations; round++) {
    const msg = await call(history);
    content.push(...(msg.content as BetaContentBlock[]));
    stops.push(msg.stop_reason ?? null);
    if (msg.stop_reason !== "pause_turn") break;
    // Resume: the paused assistant turn so far is sent back as the last message.
    history = [...messages, { role: "assistant", content: [...content] } as unknown as BetaMessageParam];
  }
  return { content, stops };
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
