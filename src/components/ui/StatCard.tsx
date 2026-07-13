import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        {Icon && (
          <Icon
            className="h-5 w-5 shrink-0 text-organization-accent"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
        {value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}
