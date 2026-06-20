import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-white",
          "text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent",
          "disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-24 p-3 rounded-md border border-[var(--color-border)] bg-white",
          "text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent",
          "resize-y",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

interface LabelProps {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}

export function Label({ htmlFor, children, required }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-[var(--color-fg)] mb-1.5"
    >
      {children}
      {required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
    </label>
  );
}

interface FieldProps {
  children: React.ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ children, hint, error }: FieldProps) {
  return (
    <div className="mb-4">
      {children}
      {hint && !error && (
        <p className="text-xs text-[var(--color-muted)] mt-1">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[var(--color-danger)] mt-1">{error}</p>
      )}
    </div>
  );
}
