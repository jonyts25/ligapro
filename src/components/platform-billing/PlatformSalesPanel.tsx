import type { PlatformSalesRow } from "@/lib/platform-sales/types";

type PlatformSalesPanelProps = {
  rows: PlatformSalesRow[];
};

function formatCreatedAt(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function PlatformSalesPanel({ rows }: PlatformSalesPanelProps) {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Organización</th>
              <th className="px-3 py-2 font-medium">Vendedor</th>
              <th className="px-3 py-2 font-medium">Temporadas activas</th>
              <th className="px-3 py-2 font-medium">Miembros</th>
              <th className="px-3 py-2 font-medium">Alta</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-text-secondary"
                >
                  No hay organizaciones para mostrar.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.organizationId} className="border-t border-border">
                  <td className="px-3 py-3 font-medium">
                    {row.organizationName}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {row.soldByDisplayName ?? "Sin atribuir"}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {row.activeSeasonCount}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {row.memberCount}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {formatCreatedAt(row.organizationCreatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-text-secondary">
        La atribución de vendedor (`sold_by_platform_staff_id`) se gestiona
        manualmente en Supabase por ahora — esta vista es solo lectura.
      </p>
    </div>
  );
}
