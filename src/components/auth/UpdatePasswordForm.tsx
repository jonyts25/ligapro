"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  updatePasswordAction,
} from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SubmitButton } from "@/components/auth/SubmitButton";

type UpdatePasswordFormProps = {
  sessionValid: boolean;
};

export function UpdatePasswordForm({ sessionValid }: UpdatePasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialAuthActionState
  );

  if (!sessionValid) {
    return (
      <AuthCard
        title="Enlace no válido"
        description="El enlace de recuperación expiró o no es válido."
      >
        <p className="text-sm text-text-secondary">
          Solicita un nuevo correo de recuperación para continuar.
        </p>
        <p className="mt-5 text-sm">
          <Link
            href="/recuperar-contrasena"
            className="font-medium text-organization-accent hover:underline"
          >
            Solicitar nuevo enlace
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Actualizar contraseña"
      description="Elige una contraseña nueva para tu cuenta."
    >
      {state.message && (
        <p
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <PasswordInput
          id="password"
          name="password"
          label="Nueva contraseña"
          autoComplete="new-password"
          required
          disabled={pending}
          error={state.fieldErrors?.password}
        />
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirmar contraseña"
          autoComplete="new-password"
          required
          disabled={pending}
          error={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton pending={pending}>Guardar contraseña</SubmitButton>
      </form>
    </AuthCard>
  );
}
