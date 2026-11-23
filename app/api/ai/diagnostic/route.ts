import { handleFlow } from "@/lib/ai/runner";
import { diagnosticFlow } from "@/lib/ai/flows/diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleFlow(req, diagnosticFlow);
}
