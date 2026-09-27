import { handleAutoGenerateChronicle } from "@/lib/chronicles/auto-generate-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAutoGenerateChronicle(request);
}
