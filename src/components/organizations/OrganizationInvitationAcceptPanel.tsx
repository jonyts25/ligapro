"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  acceptOrganizationInvitationAction,
  initialOrganizationMembersActionState,
} from "@/lib/organization-members/actions";
import type { OrganizationInvitationPreview } from "@/lib/organization-members/types";
import { roleLabel } from "@/lib/auth/validation";
import { maskEmail } from "@/lib/auth/validation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

type OrganizationInvitationAcceptPanelProps = {
  token: string;
  preview: OrganizationInvitationPreview | null;
  reason: "invalid" | "email_mismatch" | "ok" | "login_required";
  userEmail?: string | null;
  isAuthenticated: boolean;
};

export function OrganizationInvitationAcceptPanel({
  token,
  preview,
  reason,
  userEmail,
  isAuthenticated,
}: OrganizationInvitationAcceptPanelProps) {
  const [state, action, pending] = useActionState(
    acceptOrganizationInvitationAction,
    initialOrganizationMembersActionState
  );

  const loginNext = `/invitacion/org/${token}`;
  const registerHref = `/registro?next=${encodeURIComponent(loginNext)}`;
  const loginHref = `/iniciar-sesion?next=${encodeURIComponent(loginNext)}`;

  if (state.ok) {
    return (
      <AuthCard title="Invitación aceptada" description="Ya eres miembro de la organización.">
        <Link
          href="/seleccionar-organizacion"
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Ir a mis organizaciones
        </Link>
      </AuthCard>
    );
  }

  if (reason === "invalid") {
    return (
      <AuthCard
        title="Invitación no válida"
        description="Este enlace no corresponde a una invitación activa."
      >
        <p className="text-sm text-text-secondary">
          Puede haber expirado o ya haberse usado. Pide a un administrador que
          reenvíe la invitación.
        </p>
      </AuthCard>
    );
  }

  if (reason === "login_required") {
    return (
      <AuthCard
        title="Invitación a organización"
        description="Inicia sesión o crea cuenta con el correo al que llegó la invitación."
      >
        <div className="space-y-3">
          <Link
            href={loginHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            Iniciar sesión
          </Link>
          <Link
            href={registerHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Crear cuenta
          </Link>
          <GoogleSignInButton next={loginNext} />
        </div>
      </AuthCard>
    );
  }

  if (reason === "email_mismatch") {
    return (
      <AuthCard
        title="Correo distinto"
        description="La sesión actual no coincide con la invitación."
      >
        <p className="text-sm text-text-secondary">
          Estás conectado como {maskEmail(userEmail)}. Cierra sesión e ingresa
          con el correo invitado.
        </p>
        <p className="mt-4 text-sm">
          <Link href={loginHref} className="font-medium text-brand">
            Cambiar cuenta
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (!preview) return null;

  if (preview.isExpired || preview.status === "expired") {
    return (
      <AuthCard title="Invitación expirada" description="Este enlace ya no está activo.">
        <p className="text-sm text-text-secondary">
          Venció el{" "}
          {new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(preview.expiresAt))}
          .
        </p>
      </AuthCard>
    );
  }

  if (preview.status === "accepted") {
    return (
      <AuthCard title="Invitación ya utilizada" description="Este enlace ya fue aceptado.">
        <Link
          href="/seleccionar-organizacion"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Ir a mis organizaciones
        </Link>
      </AuthCard>
    );
  }

  if (preview.status !== "pending") {
    return (
      <AuthCard
        title="Invitación no disponible"
        description={`Estado: ${preview.status}`}
      >
        <p className="text-sm text-text-secondary">
          Esta invitación no puede aceptarse en su estado actual.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Unirte a la organización"
      description={preview.organizationName ?? "Acepta la invitación para acceder."}
    >
      <dl className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Correo</dt>
          <dd>{maskEmail(preview.email)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Rol</dt>
          <dd>{roleLabel(preview.role)}</dd>
        </div>
      </dl>

      {!isAuthenticated ? (
        <div className="space-y-3">
          <Link
            href={loginHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            Iniciar sesión para aceptar
          </Link>
        </div>
      ) : (
        <form action={action} className="space-y-3">
          {state.message && !state.ok && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {state.message}
            </p>
          )}
          <input type="hidden" name="token" value={token} />
          <SubmitButton pending={pending}>Aceptar invitación</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
