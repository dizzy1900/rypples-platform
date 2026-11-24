import { describe, expect, it } from "vitest";
import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { blockSummary, continuePausedTurn } from "@/lib/ai/continuation";

const msg = (stop: string, content: unknown[]) => ({ stop_reason: stop, content }) as unknown as BetaMessage;
const user: BetaMessageParam[] = [{ role: "user", content: "Research Saildrone" }];

describe("continuePausedTurn", () => {
  it("returns after one call when the turn is not paused", async () => {
    const seen: BetaMessageParam[][] = [];
    const turn = await continuePausedTurn(async (m) => (seen.push(m), msg("end_turn", [{ type: "text", text: "done" }])), user);
    expect(seen).toEqual([user]);
    expect(turn.stops).toEqual(["end_turn"]);
    expect(turn.content).toHaveLength(1);
  });

  it("resumes a paused turn with the assistant content so far and no extra user message", async () => {
    const replies = [
      msg("pause_turn", [{ type: "server_tool_use", id: "a" }, { type: "web_search_tool_result", tool_use_id: "a" }]),
      msg("pause_turn", [{ type: "web_fetch_tool_result", tool_use_id: "b" }]),
      msg("end_turn", [{ type: "text", text: "Founded 2012.", citations: [{ type: "web_search_result_location" }] }]),
    ];
    const seen: BetaMessageParam[][] = [];
    const turn = await continuePausedTurn(async (m) => (seen.push(m), replies.shift()!), user);
    expect(turn.stops).toEqual(["pause_turn", "pause_turn", "end_turn"]);
    expect(turn.content.map((b) => b.type)).toEqual(["server_tool_use", "web_search_tool_result", "web_fetch_tool_result", "text"]);
    expect(seen).toHaveLength(3);
    expect(seen[2]).toHaveLength(2);
    expect(seen[2][0]).toBe(user[0]);
    expect(seen[2][1].role).toBe("assistant");
    expect((seen[2][1].content as unknown[]).length).toBe(3);
    expect(blockSummary(turn.content)).toBe("server_tool_use:1 web_search_tool_result:1 web_fetch_tool_result:1 text+cite:1");
  });

  it("stops after the continuation limit", async () => {
    let calls = 0;
    const turn = await continuePausedTurn(async () => (calls++, msg("pause_turn", [])), user, 2);
    expect(calls).toBe(3);
    expect(turn.stops.at(-1)).toBe("pause_turn");
  });
});

describe("continuePausedTurn with a stray client tool call", () => {
  it("answers the call with an error tool_result and continues the turn", async () => {
    const replies = [
      msg("tool_use", [{ type: "web_search_tool_result", tool_use_id: "s1" }, { type: "tool_use", id: "t1", name: "fetch_page", input: {} }]),
      msg("end_turn", [{ type: "text", text: "Founded 2012.", citations: [{ type: "web_search_result_location" }] }]),
    ];
    const seen: BetaMessageParam[][] = [];
    const turn = await continuePausedTurn(async (m) => (seen.push(m), replies.shift()!), user);
    expect(turn.stops).toEqual(["tool_use", "end_turn"]);
    expect(turn.strays).toEqual(["fetch_page"]);
    expect(seen[1]).toHaveLength(3);
    expect(seen[1][1].role).toBe("assistant");
    const results = seen[1][2].content as { type: string; tool_use_id: string; is_error: boolean }[];
    expect(seen[1][2].role).toBe("user");
    expect(results).toEqual([expect.objectContaining({ type: "tool_result", tool_use_id: "t1", is_error: true })]);
    expect(blockSummary(turn.content)).toContain("text+cite:1");
  });

  it("stops on tool_use when there is no tool_use block to answer", async () => {
    const turn = await continuePausedTurn(async () => msg("tool_use", []), user);
    expect(turn.stops).toEqual(["tool_use"]);
  });
});
