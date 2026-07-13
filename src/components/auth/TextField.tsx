import { cn } from "@/lib/utils/cn";

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email";
  autoComplete?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
};

export function TextField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  error,
  required,
  disabled,
  defaultValue,
}: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue}
        className={cn(
          "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none placeholder:text-muted",
          "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          error && "border-danger",
          disabled && "opacity-60"
        )}
      />
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
