/**
 * F3 Captain: GET bootstrap (?scope=os | ?scope=bridge&slug=…), POST ask (SSE), DELETE new conversation.
 * The viewer comes from the scope; the session from the rp_demo cookie.
 */
import { handleFlow, json, priorityFrom, readJson, sessionFrom } from "@/lib/ai/runner";
import { captainBootstrap, captainFlow, captainReset, CaptainScopeNotFound, resolveViewer } from "@/lib/ai/flows/captain";
import { getState } from "@/lib/data";
import { CaptainResetInput, CaptainScope } from "@/lib/ai/schemas/captain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = CaptainScope.safeParse(url.searchParams.get("scope") === "bridge" ? { kind: "bridge", slug: url.searchParams.get("slug") ?? "" } : { kind: "os" });
  if (!scope.success) return json({ error: "Invalid scope" }, 400);
  try {
    return json(await captainBootstrap(sessionFrom(req), scope.data, priorityFrom(req)));
  } catch (err) {
    if (err instanceof CaptainScopeNotFound) return json({ error: err.message }, 404);
    throw err;
  }
}

export async function POST(req: Request) {
  // An unknown Bridge slug is a 404 before any stream starts (the body is re-read by handleFlow).
  const peek = (await req
    .clone()
    .json()
    .catch(() => null)) as { scope?: { kind?: string; slug?: unknown } } | null;
  if (peek?.scope?.kind === "bridge" && typeof peek.scope.slug === "string" && peek.scope.slug) {
    try {
      resolveViewer(await getState(sessionFrom(req)), { kind: "bridge", slug: peek.scope.slug });
    } catch (err) {
      if (err instanceof CaptainScopeNotFound) return json({ error: err.message }, 404);
      throw err;
    }
  }
  return handleFlow(req, captainFlow);
}

export async function DELETE(req: Request) {
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const parsed = CaptainResetInput.safeParse(body.body);
  if (!parsed.success) return json({ error: "Invalid scope" }, 400);
  try {
    await captainReset(sessionFrom(req), parsed.data.scope);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof CaptainScopeNotFound) return json({ error: err.message }, 404);
    throw err;
  }
}
