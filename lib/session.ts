/** Demo session (docs/03-architecture.md §5). The cookie is set by middleware.ts. */
import "server-only";
import { cookies } from "next/headers";

export const DEMO_COOKIE = "rp_demo";
export const PRIORITY_COOKIE = "rp_priority";

export async function getSessionId(): Promise<string> {
  const c = await cookies();
  return c.get(DEMO_COOKIE)?.value ?? "anonymous";
}

export async function hasPriority(): Promise<boolean> {
  const token = process.env.DEMO_PRIORITY_TOKEN;
  if (!token) return false;
  const c = await cookies();
  return c.get(PRIORITY_COOKIE)?.value === token;
}
