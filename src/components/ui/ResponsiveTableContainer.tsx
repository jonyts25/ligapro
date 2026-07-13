import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ResponsiveTableContainerProps = {
  children: ReactNode;
  className?: string;
  label?: string;
};

export function ResponsiveTableContainer({
  children,
  className,
  label = "Tabla con desplazamiento horizontal",
}: ResponsiveTableContainerProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-border bg-surface",
        className
      )}
      tabIndex={0}
      aria-label={label}
    >
      {children}
    </div>
  );
}
