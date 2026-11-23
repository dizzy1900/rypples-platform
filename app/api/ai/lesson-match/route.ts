import { handleFlow } from "@/lib/ai/runner";
import { lessonMatchFlow } from "@/lib/ai/flows/lesson-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleFlow(req, lessonMatchFlow);
}
