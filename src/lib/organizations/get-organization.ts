import { createClient } from "@/lib/supabase/server";
import type { OrganizationRecord } from "@/types/branding";

export async function getOrganizationById(
  organizationId: string
): Promise<OrganizationRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, brand_color, logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as OrganizationRecord;
}
