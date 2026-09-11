import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function LegacyAvailabilityRedirectPage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  redirect(`/organizaciones/${organizationId}/canchas/disponibilidad`);
}
