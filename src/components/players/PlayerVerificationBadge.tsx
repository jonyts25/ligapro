import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  playerVerificationLabel,
  type PlayerVerificationStatus,
} from "@/lib/players/constants";

type PlayerVerificationBadgeProps = {
  status: string;
  visible: boolean;
};

function variantForStatus(
  status: string
): "default" | "success" | "warning" | "danger" {
  switch (status as PlayerVerificationStatus) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "default";
  }
}

export function PlayerVerificationBadge({
  status,
  visible,
}: PlayerVerificationBadgeProps) {
  if (!visible) return null;
  if (status === "not_required") return null;

  return (
    <StatusBadge
      label={playerVerificationLabel(status)}
      variant={variantForStatus(status)}
    />
  );
}
