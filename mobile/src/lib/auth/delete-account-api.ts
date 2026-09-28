export type DeleteAccountResult =
  | { ok: true; status: 200 }
  | {
      ok: false;
      status: number;
      message: string;
      blockingOrganizationNames?: string[];
    };

export async function deleteOwnAccount(
  accessToken: string,
): Promise<DeleteAccountResult> {
  const siteUrl = process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!siteUrl) {
    return {
      ok: false,
      status: 0,
      message:
        "Falta EXPO_PUBLIC_SITE_URL en mobile/.env para llamar al backend.",
    };
  }

  const response = await fetch(`${siteUrl}/api/internal/account/delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 200) {
    return { ok: true, status: 200 };
  }

  let body: {
    message?: string;
    blocking_organization_names?: string[];
  } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // ignore parse errors
  }

  return {
    ok: false,
    status: response.status,
    message:
      body.message ??
      (response.status === 401
        ? "Sesión inválida. Vuelve a iniciar sesión."
        : "No pudimos eliminar tu cuenta."),
    blockingOrganizationNames: body.blocking_organization_names,
  };
}
