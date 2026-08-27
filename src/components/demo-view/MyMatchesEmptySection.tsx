"use client";

import { DemoViewOfficialEmptyNotice } from "@/components/demo-view/DemoViewRoleNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDemoView } from "@/lib/demo-view/DemoViewContext";

type MyMatchesEmptySectionProps = {
  hasAssignments: boolean;
};

export function MyMatchesEmptySection({
  hasAssignments,
}: MyMatchesEmptySectionProps) {
  const { isSimulating, viewAsRole } = useDemoView();

  if (hasAssignments) {
    return null;
  }

  const simulatingOfficialWithoutData =
    isSimulating &&
    (viewAsRole === "referee" || viewAsRole === "scorekeeper");

  if (simulatingOfficialWithoutData) {
    return <DemoViewOfficialEmptyNotice hasAssignments={false} />;
  }

  return (
    <EmptyState
      title="Sin partidos asignados"
      description="Cuando te designen árbitro, delegado u otro rol en un partido de temporadas activas, aparecerán aquí con enlace a captura."
    />
  );
}
