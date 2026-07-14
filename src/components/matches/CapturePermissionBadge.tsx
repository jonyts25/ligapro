import { StatusBadge } from "@/components/ui/StatusBadge";

type CapturePermissionBadgeProps = {
  canCaptureEvents: boolean;
  canUpdateResult: boolean;
};

export function CapturePermissionBadge({
  canCaptureEvents,
  canUpdateResult,
}: CapturePermissionBadgeProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge
        label={canCaptureEvents ? "Puede capturar eventos" : "Sin captura de eventos"}
        variant={canCaptureEvents ? "success" : "warning"}
      />
      <StatusBadge
        label={
          canUpdateResult
            ? "Puede actualizar marcador"
            : "Sin actualización de marcador"
        }
        variant={canUpdateResult ? "success" : "default"}
      />
    </div>
  );
}
