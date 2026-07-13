import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { SeasonRulesRecord } from "@/lib/competitions/types";

type SeasonRulesSummaryProps = {
  rules: SeasonRulesRecord;
};

export function SeasonRulesSummary({ rules }: SeasonRulesSummaryProps) {
  const rows = [
    { label: "Victoria", value: `${rules.points_win} pts` },
    { label: "Empate", value: `${rules.points_draw} pts` },
    { label: "Derrota", value: `${rules.points_loss} pts` },
    {
      label: "Empates",
      value: rules.allow_draws ? "Permitidos" : "No permitidos",
    },
    {
      label: "Duración",
      value: `${rules.match_duration_minutes} min`,
    },
    {
      label: "Descanso mínimo",
      value: `${rules.minimum_rest_minutes} min`,
    },
    {
      label: "Límite de amarillas",
      value: String(rules.yellow_card_limit),
    },
    {
      label: "Suspensión",
      value: `${rules.suspension_matches} partido${rules.suspension_matches === 1 ? "" : "s"}`,
    },
  ];

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Reglas deportivas"
        description="Configuración vigente de la temporada."
      />
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wide text-muted">
              {row.label}
            </dt>
            <dd className="mt-1 text-sm font-medium text-text-primary">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
