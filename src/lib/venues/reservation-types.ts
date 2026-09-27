export const NON_MATCH_RESERVATION_TYPES = [
  "maintenance",
  "private_rental",
  "closed",
  "manual_block",
] as const;

export type NonMatchReservationType =
  (typeof NON_MATCH_RESERVATION_TYPES)[number];

export type FieldReservationType =
  | NonMatchReservationType
  | "match";

export const RESERVATION_TYPE_LABELS: Record<FieldReservationType, string> = {
  maintenance: "Mantenimiento",
  private_rental: "Renta particular",
  closed: "Cerrada",
  manual_block: "Bloqueo manual",
  match: "Partido",
};

export type ReservationTypeVisual = {
  label: string;
  cellClass: string;
  badgeVariant: "default" | "info" | "success" | "warning" | "danger";
};

export function reservationTypeVisual(
  reservationType: string
): ReservationTypeVisual {
  switch (reservationType) {
    case "maintenance":
      return {
        label: RESERVATION_TYPE_LABELS.maintenance,
        cellClass: "bg-warning/25 text-warning-foreground border-warning/40",
        badgeVariant: "warning",
      };
    case "private_rental":
      return {
        label: RESERVATION_TYPE_LABELS.private_rental,
        cellClass: "bg-brand/15 text-brand border-brand/30",
        badgeVariant: "info",
      };
    case "closed":
      return {
        label: RESERVATION_TYPE_LABELS.closed,
        cellClass: "bg-muted/30 text-muted border-border",
        badgeVariant: "default",
      };
    case "manual_block":
      return {
        label: RESERVATION_TYPE_LABELS.manual_block,
        cellClass: "bg-danger/15 text-danger border-danger/30",
        badgeVariant: "danger",
      };
    case "match":
      return {
        label: RESERVATION_TYPE_LABELS.match,
        cellClass: "bg-info/20 text-info border-info/40",
        badgeVariant: "info",
      };
    default:
      return {
        label: reservationType,
        cellClass: "bg-muted/20 text-text-secondary border-border",
        badgeVariant: "default",
      };
  }
}

export function isNonMatchReservationType(
  value: string
): value is NonMatchReservationType {
  return (NON_MATCH_RESERVATION_TYPES as readonly string[]).includes(value);
}
