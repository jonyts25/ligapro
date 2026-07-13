import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type AuthCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function AuthCard({
  title,
  description,
  children,
  className,
}: AuthCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6",
        className
      )}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-sm text-text-secondary">{description}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
