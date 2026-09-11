import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function LegacyVenuesRedirectPage({ params }: PageProps) {
  const { organizationId } = await params;
  redirect(`/organizaciones/${organizationId}/canchas`);
}
