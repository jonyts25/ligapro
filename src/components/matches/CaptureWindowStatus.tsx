import { StatusBadge } from "@/components/ui/StatusBadge";

type CaptureWindowStatusProps = {
  canCaptureEvents: boolean;
  captureWindowOpen: boolean;
  captureWindowBypass: boolean;
};

export function CaptureWindowStatus({
  canCaptureEvents,
  captureWindowOpen,
  captureWindowBypass,
}: CaptureWindowStatusProps) {
  if (!canCaptureEvents) return null;

  if (captureWindowBypass) {
    return (
      <p
        className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary"
        role="status"
      >
        Ventana de captura: sin límite para administradores de liga o torneo.
      </p>
    );
  }

  if (captureWindowOpen) {
    return (
      <StatusBadge
        label="Ventana de captura abierta"
        variant="success"
      />
    );
  }

  return (
    <p
      className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      role="status"
    >
      La ventana de captura para este partido ya cerró. Solo administradores de
      liga o torneo pueden registrar cambios fuera de horario.
    </p>
  );
}
