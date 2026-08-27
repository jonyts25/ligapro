"use client";

import { DEMO_VIEW_ROLES, DEMO_VIEW_ROLE_LABELS } from "@/lib/demo-view/types";
import { useDemoView } from "@/lib/demo-view/DemoViewContext";
import { cn } from "@/lib/utils/cn";

export function DemoViewBar() {
  const { isPlatformStaff, viewAsRole, setViewAsRole, isSimulating } =
    useDemoView();

  if (!isPlatformStaff) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-50 border-b-2 px-4 py-2 text-sm shadow-md",
        isSimulating
          ? "border-amber-500 bg-amber-100 text-amber-950"
          : "border-violet-500 bg-violet-100 text-violet-950"
      )}
      role="region"
      aria-label="Modo demo de visualización"
    >
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-3">
        <p className="font-semibold">
          {isSimulating
            ? `Modo demo: viendo como ${DEMO_VIEW_ROLE_LABELS[viewAsRole]}`
            : "Modo demo disponible (solo renderizado — permisos reales intactos)"}
        </p>
        <label className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">
            Simular vista
          </span>
          <select
            value={viewAsRole}
            onChange={(event) =>
              setViewAsRole(event.target.value as (typeof DEMO_VIEW_ROLES)[number])
            }
            className="min-h-10 rounded-lg border border-current/30 bg-white/80 px-2 text-sm text-text-primary shadow-sm"
          >
            {DEMO_VIEW_ROLES.map((role) => (
              <option key={role} value={role}>
                {DEMO_VIEW_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
