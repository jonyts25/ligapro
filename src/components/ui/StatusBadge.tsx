import { cn } from "@/lib/utils/cn";

export type StatusBadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "scheduled"
  | "live"
  | "finished"
  | "yellow-card"
  | "red-card";

const VARIANT_STYLES: Record<StatusBadgeVariant, string> = {
  default: "bg-surface-elevated text-text-secondary border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-info/15 text-info border-info/30",
  scheduled: "bg-info/15 text-info border-info/30",
  live: "bg-danger/15 text-danger border-danger/30",
  finished: "bg-surface-elevated text-text-secondary border-border",
  "yellow-card": "bg-card-yellow/20 text-card-yellow border-card-yellow/40",
  "red-card": "bg-card-red/20 text-card-red border-card-red/40",
};

type StatusBadgeProps = {
  label: string;
  variant?: StatusBadgeVariant;
  className?: string;
};

export function StatusBadge({
  label,
  variant = "default",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
