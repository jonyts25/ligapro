"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type SubmitButtonProps = {
  children: ReactNode;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
};

export function SubmitButton({
  children,
  pending,
  disabled,
  className,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition-opacity",
        "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {pending ? "Procesando…" : children}
    </button>
  );
}
