import type { ReactNode } from "react";

/** Beta: always serve fresh public read models after capture/schedule mutations. */
export const dynamic = "force-dynamic";

export default function PublicRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
