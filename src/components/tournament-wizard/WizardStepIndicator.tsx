import { WIZARD_STEPS, type WizardStepKey } from "@/lib/tournament-wizard/types";
import { cn } from "@/lib/utils/cn";

type WizardStepIndicatorProps = {
  currentStep: WizardStepKey;
};

const STEP_ORDER: WizardStepKey[] = [
  "inicio",
  "equipos",
  "jugadores",
  "horarios",
  "generar",
];

export function WizardStepIndicator({ currentStep }: WizardStepIndicatorProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {WIZARD_STEPS.map((step, index) => {
        const isCurrent = step.key === currentStep;
        const isComplete = index < currentIndex;

        return (
          <li
            key={step.key}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              isCurrent && "border-brand bg-brand/10 text-brand",
              isComplete && "border-success/40 bg-success/10 text-success",
              !isCurrent && !isComplete && "border-border text-muted"
            )}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}
