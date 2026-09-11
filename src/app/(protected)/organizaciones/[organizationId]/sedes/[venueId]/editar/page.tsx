import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string; venueId: string }>;
};

export default async function LegacyVenueEditRedirectPage({ params }: PageProps) {
  const { organizationId, venueId } = await params;
  redirect(`/organizaciones/${organizationId}/sedes/${venueId}`);
}
