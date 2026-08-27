"use client";

import Link from "next/link";
import { DEMO_VIEW_NO_DATA_MESSAGE } from "@/lib/demo-view/types";
import { useDemoView } from "@/lib/demo-view/DemoViewContext";
import { Card } from "@/components/ui/Card";

type DemoViewRoleNoticeProps = {
  className?: string;
};

export function DemoViewCaptainNotice({ className }: DemoViewRoleNoticeProps) {
  const {
    showCaptainPortalNotice,
    hasCaptainTeams,
    isSimulating,
  } = useDemoView();

  if (!showCaptainPortalNotice) {
    return null;
  }

  if (hasCaptainTeams) {
    return (
      <Card className={className}>
        <p className="text-sm text-text-secondary">
          Vista simulada de capitán: el portal de equipo está en{" "}
          <Link href="/mi-equipo" className="font-medium text-brand underline-offset-2 hover:underline">
            Mi equipo
          </Link>
          . Los módulos de administración de la organización están ocultos en
          esta simulación.
        </p>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <p className="text-sm text-text-secondary">{DEMO_VIEW_NO_DATA_MESSAGE}</p>
    </Card>
  );
}

type DemoViewOfficialEmptyNoticeProps = {
  hasAssignments: boolean;
};

export function DemoViewOfficialEmptyNotice({
  hasAssignments,
}: DemoViewOfficialEmptyNoticeProps) {
  const { isSimulating, viewAsRole } = useDemoView();

  if (
    !isSimulating ||
    hasAssignments ||
    (viewAsRole !== "referee" && viewAsRole !== "scorekeeper")
  ) {
    return null;
  }

  return (
    <Card>
      <p className="text-sm text-text-secondary">{DEMO_VIEW_NO_DATA_MESSAGE}</p>
    </Card>
  );
}
