type DataCompletenessWarningProps = {
  title?: string;
  description: string;
};

export function DataCompletenessWarning({
  title = "Datos incompletos",
  description,
}: DataCompletenessWarningProps) {
  return (
    <div
      role="status"
      className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-secondary"
    >
      <p className="font-medium text-warning">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}
