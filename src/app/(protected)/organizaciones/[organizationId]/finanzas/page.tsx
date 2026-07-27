import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

async function listSeasons(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, competition_id, competitions(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((s) => {
    const rel = s.competitions as
      | { name: string }
      | { name: string }[]
      | null;
    const competitionName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    return {
      seasonId: s.id,
      seasonName: s.name,
      competitionId: s.competition_id,
      competitionName: competitionName ?? "Torneo",
    };
  });
}

export default async function OrganizationFinanceHubPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);
  const seasons = await listSeasons(organizationId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Finanzas"
        description="Elige una temporada para ver cargos, pagos e inscripciones."
      />
      {!seasons.length ? (
        <EmptyState
          title="Sin temporadas"
          description="El ledger financiero se gestiona por temporada."
        />
      ) : (
        <ul className="space-y-3">
          {seasons.map((s) => (
            <li key={s.seasonId}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">{s.seasonName}</p>
                  <p className="text-sm text-text-secondary">
                    {s.competitionName}
                  </p>
                </div>
                <Link
                  href={`/organizaciones/${organizationId}/torneos/${s.competitionId}/temporadas/${s.seasonId}/finanzas`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                >
                  Ver finanzas
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
