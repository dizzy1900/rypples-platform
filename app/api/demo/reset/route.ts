import { NextResponse } from "next/server";

/** Reset demo: rotate the visitor's session id; old events are orphaned (docs/03-architecture.md §5). */
export async function POST(req: Request) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const sid = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("rp_demo", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
