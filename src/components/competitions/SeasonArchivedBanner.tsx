import { Card } from "@/components/ui/Card";

export function SeasonArchivedBanner() {
  return (
    <Card className="border-warning/40 bg-warning/10 px-4 py-3">
      <p className="text-sm font-medium text-text-primary">
        Temporada archivada
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Consulta en solo lectura. Los partidos, resultados, cargos y disciplina
        se conservan. La gestión operativa (fixture, captura, finanzas, etc.)
        está deshabilitada hasta reactivar.
      </p>
    </Card>
  );
}
