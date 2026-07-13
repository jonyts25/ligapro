"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
} from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { AuthCard } from "@/components/auth/AuthCard";
import { TextField } from "@/components/auth/TextField";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialAuthActionState
  );

  return (
    <AuthCard
      title="Recuperar contraseña"
      description="Te enviaremos instrucciones si existe una cuenta asociada."
    >
      {state.message && (
        <p
          className="mb-4 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary"
          role="status"
        >
          {state.message}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <TextField
          id="email"
          name="email"
          label="Correo"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
        <SubmitButton pending={pending}>Enviar instrucciones</SubmitButton>
      </form>

      <p className="mt-5 text-sm text-text-secondary">
        <Link
          href="/iniciar-sesion"
          className="font-medium text-organization-accent hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthCard>
  );
}
