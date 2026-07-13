import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return null;
  }

  const userId = claimsData.claims.sub;
  const emailFromClaims =
    typeof claimsData.claims.email === "string"
      ? claimsData.claims.email
      : null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", userId)
    .maybeSingle();

  return {
    id: userId,
    email: profile?.email ?? emailFromClaims,
    displayName: profile?.display_name ?? null,
  };
}
