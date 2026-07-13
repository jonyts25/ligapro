import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { resolveAuthDestination } from "@/lib/auth/resolve-auth-destination";

export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/iniciar-sesion");
  }

  const destination = await resolveAuthDestination(user.id);
  redirect(destination);
}
