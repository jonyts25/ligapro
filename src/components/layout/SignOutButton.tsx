"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

type SignOutButtonProps = {
  compact?: boolean;
  className?: string;
};

export function SignOutButton({ compact, className }: SignOutButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => signOutAction())}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-60",
        compact && "min-w-11 px-0",
        className
      )}
      aria-label="Cerrar sesión"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {!compact && <span>{pending ? "Saliendo…" : "Cerrar sesión"}</span>}
    </button>
  );
}
