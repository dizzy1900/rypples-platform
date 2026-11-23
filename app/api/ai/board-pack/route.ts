import { handleFlow } from "@/lib/ai/runner";
import { boardPackFlow } from "@/lib/ai/flows/board-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleFlow(req, boardPackFlow);
}
