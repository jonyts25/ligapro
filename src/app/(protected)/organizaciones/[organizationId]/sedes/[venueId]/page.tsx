import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ organizationId: string; venueId: string }>;
};

export default async function LegacyVenueDetailRedirectPage({ params }: PageProps) {
  const { organizationId, venueId } = await params;
  const supabase = await createClient();
  const { data: field } = await supabase
    .from("fields")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (field?.id) {
    redirect(`/organizaciones/${organizationId}/canchas/${field.id}`);
  }

  redirect(`/organizaciones/${organizationId}/canchas`);
}
