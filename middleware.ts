import { NextResponse, type NextRequest } from "next/server";

const DEMO_COOKIE = "rp_demo";
const PRIORITY_COOKIE = "rp_priority";

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  let sid = req.cookies.get(DEMO_COOKIE)?.value;
  const setSid = !sid;
  if (!sid) {
    sid = randomId();
    // make the new cookie visible to this same request's server components
    const existing = headers.get("cookie");
    headers.set("cookie", `${existing ? existing + "; " : ""}${DEMO_COOKIE}=${sid}`);
  }

  const k = req.nextUrl.searchParams.get("k");
  const token = process.env.DEMO_PRIORITY_TOKEN;
  const grantPriority = !!token && k === token;
  if (grantPriority) {
    const existing = headers.get("cookie");
    headers.set("cookie", `${existing ? existing + "; " : ""}${PRIORITY_COOKIE}=${token}`);
  }

  const res = NextResponse.next({ request: { headers } });
  const secure = req.nextUrl.protocol === "https:";
  if (setSid) {
    res.cookies.set(DEMO_COOKIE, sid, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  if (grantPriority) {
    res.cookies.set(PRIORITY_COOKIE, token!, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 7 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|people/|data/).*)"],
};
