"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PasswordInputProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

export function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  error,
  required,
  disabled,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          className={cn(
            "min-h-11 w-full rounded-xl border border-border bg-background px-3 pr-12 text-sm text-text-primary outline-none placeholder:text-muted",
            "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            error && "border-danger",
            disabled && "opacity-60"
          )}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex min-w-11 items-center justify-center text-text-secondary hover:text-text-primary"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
