import { handleFlow } from "@/lib/ai/runner";
import { anyCompanyFlow } from "@/lib/ai/flows/any-company";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  return handleFlow(req, anyCompanyFlow);
}
