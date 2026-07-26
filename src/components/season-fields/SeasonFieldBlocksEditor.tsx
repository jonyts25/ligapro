"use client";

import { useMemo, useState, useTransition } from "react";
import { setSeasonFieldBlocksAction } from "@/lib/season-fields/actions";
import type {
  ActiveFieldOption,
  SeasonFieldBlock,
} from "@/lib/season-fields/types";
import { DAY_LABELS_ES } from "@/lib/venues/types";
import { validateAvailabilityIntervals } from "@/lib/venues/availability-validation";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type DraftBlock = {
  key: string;
  field_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

type SeasonFieldBlocksEditorProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  fields: ActiveFieldOption[];
  initialBlocks: SeasonFieldBlock[];
};

function toDraftBlocks(blocks: SeasonFieldBlock[]): DraftBlock[] {
  return blocks.map((block) => ({
    key: block.id ?? crypto.randomUUID(),
    field_id: block.field_id,
    day_of_week: block.day_of_week,
    starts_at: block.starts_at,
    ends_at: block.ends_at,
  }));
}

export function SeasonFieldBlocksEditor({
  organizationId,
  competitionId,
  seasonId,
  fields,
  initialBlocks,
}: SeasonFieldBlocksEditorProps) {
  const [blocks, setBlocks] = useState<DraftBlock[]>(() =>
    toDraftBlocks(initialBlocks)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const fieldOptions = useMemo(
    () =>
      fields.map((f) => ({
        id: f.id,
        label: `${f.venueName} · ${f.name}`,
      })),
    [fields]
  );

  function addBlock() {
    const defaultField = fieldOptions[0]?.id ?? "";
    setBlocks((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        field_id: defaultField,
        day_of_week: 4,
        starts_at: "18:00",
        ends_at: "20:00",
      },
    ]);
  }

  function removeBlock(key: string) {
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  }

  function updateBlock(key: string, patch: Partial<DraftBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b))
    );
  }

  function onSave() {
    setMessage(null);
    for (const block of blocks) {
      const validationError = validateAvailabilityIntervals([
        {
          day_of_week: block.day_of_week,
          starts_at: block.starts_at,
          ends_at: block.ends_at,
        },
      ]);
      if (validationError) {
        setOk(false);
        setMessage(validationError);
        return;
      }
      if (!block.field_id) {
        setOk(false);
        setMessage("Selecciona una cancha para cada bloqueo.");
        return;
      }
    }

    startTransition(async () => {
      const result = await setSeasonFieldBlocksAction({
        organizationId,
        competitionId,
        seasonId,
        blocks: blocks.map((b) => ({
          field_id: b.field_id,
          day_of_week: b.day_of_week,
          starts_at: b.starts_at,
          ends_at: b.ends_at,
        })),
      });
      setOk(result.ok);
      setMessage(result.message);
    });
  }

  if (fieldOptions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">
          No hay canchas activas en la organización. Configura sedes y canchas
          antes de definir bloqueos.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Bloqueos de cancha para esta temporada"
        description="Reserva franjas semanales a favor de este torneo. Otros torneos no podrán programar en el mismo horario."
      />
      {message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={ok ? "status" : "alert"}
        >
          {message}
        </p>
      )}
      <ul className="space-y-3">
        {blocks.map((block) => (
          <li
            key={block.key}
            className="rounded-xl border border-border bg-background/40 p-3 space-y-3"
          >
            <div className="space-y-1.5">
              <label className="block text-xs text-muted">Cancha</label>
              <select
                value={block.field_id}
                disabled={pending}
                onChange={(e) =>
                  updateBlock(block.key, { field_id: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {fieldOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-xs text-muted">Día</label>
                <select
                  value={block.day_of_week}
                  disabled={pending}
                  onChange={(e) =>
                    updateBlock(block.key, {
                      day_of_week: Number(e.target.value),
                    })
                  }
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  {DAY_LABELS_ES.map((label, day) => (
                    <option key={day} value={day}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-muted">Inicio</label>
                <input
                  type="time"
                  value={block.starts_at}
                  disabled={pending}
                  onChange={(e) =>
                    updateBlock(block.key, { starts_at: e.target.value })
                  }
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-muted">Fin</label>
                <input
                  type="time"
                  value={block.ends_at}
                  disabled={pending}
                  onChange={(e) =>
                    updateBlock(block.key, { ends_at: e.target.value })
                  }
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-2 text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => removeBlock(block.key)}
              className="text-sm text-danger hover:underline"
            >
              Quitar bloqueo
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={addBlock}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Añadir bloqueo
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          {pending ? "Guardando…" : "Guardar bloqueos"}
        </button>
      </div>
    </Card>
  );
}
