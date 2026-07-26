import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getCaptainTeams } from "@/lib/auth/get-captain-teams";

export default async function CaptainPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const teams = await getCaptainTeams(user.id);

  if (!teams.length) {
    redirect("/onboarding");
  }

  return children;
}
