import { handleDeleteAccount } from "@/lib/auth/delete-account-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleDeleteAccount(request);
}
