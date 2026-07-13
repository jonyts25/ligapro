import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { CurrentUser } from "@/lib/auth/types";

export async function requireUser(
  loginPath = "/iniciar-sesion"
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(loginPath);
  }
  return user;
}
