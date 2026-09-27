"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  analyzeExcelImportAction,
  confirmExcelImportAction,
} from "@/lib/teams/excel-import-actions";
import {
  initialExcelImportActionState,
  type ExcelImportActionState,
} from "@/lib/teams/excel-import/types";
import {
  EXCEL_IMPORT_ACCEPT,
  EXCEL_IMPORT_FIELD_LABELS,
  EXCEL_IMPORT_FIELDS,
  EXCEL_IMPORT_MAX_FILE_BYTES,
  mappingFieldName,
  parseHeadersFromPreview,
  YOUTH_TOURNAMENT_IMPORT_BLOCKED_MESSAGE,
} from "@/lib/teams/excel-import/constants";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SubmitButton } from "@/components/auth/SubmitButton";

type ExcelSeasonImportPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  isYouth: boolean;
  disabled?: boolean;
};

function PreviewTable({
  preview,
}: {
  preview: NonNullable<ExcelImportActionState["preview"]>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-muted/20">
          <tr>
            <th className="px-3 py-2">Fila</th>
            <th className="px-3 py-2">Equipo</th>
            <th className="px-3 py-2">Jugador</th>
            <th className="px-3 py-2">Dorsal</th>
            <th className="px-3 py-2">Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {preview.previewRows.map((row) => (
            <tr key={row.rowNumber} className="border-t border-border">
              <td className="px-3 py-2">{row.rowNumber}</td>
              <td className="px-3 py-2">{row.equipo || "—"}</td>
              <td className="px-3 py-2">{row.jugador || "—"}</td>
              <td className="px-3 py-2">{row.dorsal ?? "—"}</td>
              <td className="px-3 py-2">{row.telefono ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExcelSeasonImportPanel({
  organizationId,
  competitionId,
  seasonId,
  isYouth,
  disabled = false,
}: ExcelSeasonImportPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzeState, analyzeAction, analyzePending] = useActionState(
    analyzeExcelImportAction,
    initialExcelImportActionState
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmExcelImportAction,
    initialExcelImportActionState
  );

  const preview = analyzeState.preview;
  const summary = confirmState.summary;
  const headerOptions = useMemo(() => preview?.headers ?? [], [preview?.headers]);
  const fileRef = useRef<File | null>(null);

  if (isYouth) {
    return (
      <Card className="space-y-3">
        <SectionHeader
          title="Importar desde Excel"
          description="Migración rápida de equipos y jugadores."
        />
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-secondary">
          {YOUTH_TOURNAMENT_IMPORT_BLOCKED_MESSAGE}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Importar desde Excel"
        description="Descarga la plantilla, completa equipos/jugadores/dorsales y súbela para mapear columnas con IA."
      />

      <p className="text-sm text-text-secondary">
        Límite de archivo: {Math.round(EXCEL_IMPORT_MAX_FILE_BYTES / (1024 * 1024))}{" "}
        MB. Solo se envían a la IA los encabezados y las primeras 10 filas; el
        archivo completo se procesa en el servidor al confirmar.
      </p>

      <div className="flex flex-wrap gap-3">
        <a
          href="/api/export/excel-roster-template"
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Descargar plantilla .xlsx
        </a>
      </div>

      {!preview && !summary && (
        <form action={analyzeAction} className="space-y-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input
            type="file"
            name="file"
            accept={EXCEL_IMPORT_ACCEPT}
            disabled={disabled || analyzePending}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              fileRef.current = file;
            }}
            className="block w-full text-sm"
          />
          <SubmitButton pending={analyzePending} disabled={disabled || !selectedFile}>
            Analizar archivo
          </SubmitButton>
          {analyzeState.message && !analyzeState.ok && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {analyzeState.message}
            </p>
          )}
        </form>
      )}

      {preview && !summary && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {analyzeState.message} ({preview.totalRowCount} fila
            {preview.totalRowCount === 1 ? "" : "s"} detectadas)
          </p>

          <form
            action={(formData) => {
              const file = fileRef.current ?? selectedFile;
              if (file) {
                formData.set("file", file);
              }
              return confirmAction(formData);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="seasonId" value={seasonId} />
            <input
              type="hidden"
              name="headersJson"
              value={parseHeadersFromPreview(preview.headers)}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {EXCEL_IMPORT_FIELDS.map((field) => (
                <label key={field} className="space-y-1 text-sm">
                  <span className="font-medium">{EXCEL_IMPORT_FIELD_LABELS[field]}</span>
                  <select
                    name={mappingFieldName(field)}
                    defaultValue={preview.mapping[field] ?? ""}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3"
                    disabled={confirmPending}
                  >
                    <option value="">(No importar)</option>
                    {headerOptions.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <PreviewTable preview={preview} />

            <div className="flex flex-wrap gap-3">
              <SubmitButton pending={confirmPending} disabled={disabled}>
                Confirmar importación
              </SubmitButton>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
                onClick={() => window.location.reload()}
              >
                Cancelar
              </button>
            </div>

            {confirmState.message && !confirmState.ok && (
              <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {confirmState.message}
              </p>
            )}
          </form>
        </div>
      )}

      {summary && (
        <div className="space-y-3">
          <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {confirmState.message}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
            <li>Equipos nuevos: {summary.teamsCreated}</li>
            <li>Inscripciones nuevas en el torneo: {summary.teamsEnrolled}</li>
            <li>Jugadores creados: {summary.playersCreated}</li>
          </ul>
          {summary.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Advertencias</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-warning">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.skippedRows.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Filas omitidas</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-text-secondary">
                {summary.skippedRows.map((row) => (
                  <li key={`${row.rowNumber}-${row.reason}`}>
                    Fila {row.rowNumber}: {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
