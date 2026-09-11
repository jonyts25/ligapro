import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function LegacyFieldAvailabilityOverviewPage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  redirect(`/organizaciones/${organizationId}/canchas/disponibilidad`);
}
