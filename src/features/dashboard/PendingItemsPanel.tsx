import Link from "next/link";
import type { OrganizationPendingItems } from "@/lib/dashboard/pending-items-core";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PendingItemsPanelProps = {
  pendingItems: OrganizationPendingItems;
};

function categoryVariant(
  categoryId: OrganizationPendingItems["categories"][number]["id"]
): "default" | "warning" | "danger" {
  if (
    categoryId === "open_disputes" ||
    categoryId === "results_not_captured"
  ) {
    return "danger";
  }
  if (
    categoryId === "matches_without_referee" ||
    categoryId === "teams_with_balance_due"
  ) {
    return "warning";
  }
  return "default";
}

export function PendingItemsPanel({ pendingItems }: PendingItemsPanelProps) {
  if (pendingItems.allClear) {
    return (
      <Card className="mb-8 space-y-2">
        <SectionHeader
          title="Pendientes"
          description="Acciones que requieren atención del administrador."
        />
        <p className="text-sm text-success">Todo al día</p>
      </Card>
    );
  }

  return (
    <section aria-labelledby="pending-items-heading" className="mb-8 space-y-4">
      <SectionHeader
        title="Pendientes"
        description="Acciones que requieren atención del administrador."
      />
      <h2 id="pending-items-heading" className="sr-only">
        Pendientes
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {pendingItems.categories
          .filter((category) => category.totalCount > 0)
          .map((category) => (
            <Card key={category.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {category.title}
                  </h3>
                  <p className="text-xs text-muted">
                    {category.totalCount}{" "}
                    {category.totalCount === 1 ? "pendiente" : "pendientes"}
                  </p>
                </div>
                <StatusBadge
                  label={String(category.totalCount)}
                  variant={categoryVariant(category.id)}
                />
              </div>

              <ul className="space-y-2">
                {category.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="block rounded-xl border border-border px-3 py-2 text-sm transition hover:border-brand/40 hover:bg-brand/5"
                    >
                      <p className="font-medium text-text-primary">
                        {item.label}
                      </p>
                      {item.detail && (
                        <p className="text-xs text-text-secondary">
                          {item.detail}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              {category.viewAllHref && category.totalCount > category.items.length && (
                <Link
                  href={category.viewAllHref}
                  className="inline-flex text-sm font-medium text-brand hover:underline"
                >
                  Ver todas
                </Link>
              )}
            </Card>
          ))}
      </div>
    </section>
  );
}
