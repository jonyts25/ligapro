"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createSeasonFixtureAction } from "@/lib/fixtures/actions";
import {
  generateRoundRobinFixture,
  type FixtureMode,
} from "@/lib/fixtures/round-robin";
import {
  initialFixtureActionState,
  type SeasonFixtureContext,
} from "@/lib/fixtures/types";
import { FixturePreview } from "@/components/fixtures/FixturePreview";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type FixtureGeneratorFormProps = {
  context: SeasonFixtureContext;
};

export function FixtureGeneratorForm({ context }: FixtureGeneratorFormProps) {
  const defaultMode: FixtureMode =
    context.formatType === "round_robin_double" ? "double" : "single";
  const [mode, setMode] = useState<FixtureMode>(defaultMode);
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    createSeasonFixtureAction,
    initialFixtureActionState
  );

  const teamNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of context.eligibleTeams) {
      map.set(t.seasonTeamId, t.name);
    }
    return map;
  }, [context.eligibleTeams]);

  const preview = useMemo(() => {
    if (context.eligibleTeams.length < 2) return null;
    try {
      return generateRoundRobinFixture(
        context.eligibleTeams.map((t) => ({
          seasonTeamId: t.seasonTeamId,
          name: t.name,
        })),
        mode
      );
    } catch {
      return null;
    }
  }, [context.eligibleTeams, mode]);

  if (!context.supportsAutoFixture) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          El generador automático aún no está disponible para el formato{" "}
          <span className="font-medium text-text-primary">
            {context.formatType}
          </span>
          . Solo se soporta round-robin de liga (una vuelta o ida y vuelta).
        </p>
      </Card>
    );
  }

  if (context.existingMatchCount > 0) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          Esta temporada ya tiene fixture ({context.existingMatchCount}{" "}
          partidos). En F6 no se permite regenerar.
        </p>
      </Card>
    );
  }

  if (context.eligibleTeams.length < 2) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          Se necesitan al menos dos equipos inscritos (registered/confirmed)
          para generar el fixture.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <p className="text-sm font-medium text-text-primary">
            Equipos elegibles: {context.eligibleTeams.length} (
            {context.eligibleTeams.length % 2 === 0 ? "par" : "impar"})
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-text-secondary">
            {context.eligibleTeams.map((t) => (
              <li key={t.seasonTeamId}>{t.name}</li>
            ))}
          </ul>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Modalidad</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="modePreview"
              checked={mode === "single"}
              onChange={() => {
                setMode("single");
                setConfirmed(false);
              }}
              disabled={pending}
            />
            Una vuelta
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="modePreview"
              checked={mode === "double"}
              onChange={() => {
                setMode("double");
                setConfirmed(false);
              }}
              disabled={pending}
            />
            Ida y vuelta
          </label>
        </fieldset>
      </Card>

      {preview && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">Vista previa</h2>
          <FixturePreview fixture={preview} teamNames={teamNames} />
        </Card>
      )}

      <Card>
        {state.message && (
          <p
            className={cn(
              "mb-4 rounded-xl border px-3 py-2 text-sm",
              state.ok
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger"
            )}
            role="alert"
          >
            {state.message}
          </p>
        )}
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="organizationId" value={context.organizationId} />
          <input type="hidden" name="competitionId" value={context.competitionId} />
          <input type="hidden" name="seasonId" value={context.seasonId} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="confirmed" value={confirmed ? "1" : "0"} />

          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-secondary">
            Después de guardar no se puede regenerar el fixture en F6. Revisa la
            vista previa con cuidado.
          </p>

          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={pending}
            />
            Confirmo que quiero guardar este fixture definitivamente.
          </label>

          <SubmitButton pending={pending} disabled={!confirmed || !preview}>
            Guardar fixture
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
