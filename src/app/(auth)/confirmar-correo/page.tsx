import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { maskEmail } from "@/lib/auth/validation";

type PageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function ConfirmEmailPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const masked = maskEmail(params.email);

  return (
    <AuthCard
      title="Revisa tu correo"
      description="Te enviamos un enlace para confirmar tu cuenta."
    >
      <p className="text-sm text-text-secondary">
        {masked
          ? `Busca el mensaje enviado a ${masked} y sigue el enlace de confirmación.`
          : "Busca el mensaje de confirmación en tu bandeja de entrada y sigue el enlace."}
      </p>
      <p className="mt-4 text-sm text-muted">
        Si no lo ves, revisa spam o correo no deseado.
      </p>
      <p className="mt-6 text-sm">
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
