import { handleFlow } from "@/lib/ai/runner";
import { dayOneFlow } from "@/lib/ai/flows/day-one";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleFlow(req, dayOneFlow);
}
