import type { InputHTMLAttributes } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  hint?: string;
};

/** Labelled `.field` input, with an optional hint underneath. */
export function AuthField({ name, label, hint, ...input }: AuthFieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className="stack gap-2">
      <label htmlFor={name} className="text-body-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="field"
        aria-describedby={hintId}
        {...input}
      />
      {hint && (
        <p id={hintId} className="type-meta">
          {hint}
        </p>
      )}
    </div>
  );
}
