import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function LegacyNewVenueRedirectPage({ params }: PageProps) {
  const { organizationId } = await params;
  redirect(`/organizaciones/${organizationId}/canchas/nueva`);
}
