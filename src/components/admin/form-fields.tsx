import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/*
 * Labelled admin controls. Each shows an optional hint and an error from the
 * action's `fieldErrors`, and links both to the control so screen readers
 * announce them. Pass the previous value as `defaultValue` (from the form
 * state's `values` after an error): React resets the form once the action
 * returns.
 */

type ShellProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

function describedBy(name: string, hint?: string, error?: string) {
  const ids = [hint && `${name}-hint`, error && `${name}-error`].filter(
    Boolean,
  );
  return ids.length ? ids.join(" ") : undefined;
}

function FieldShell({
  name,
  label,
  hint,
  error,
  children,
}: ShellProps & { children: ReactNode }) {
  return (
    <div className="stack gap-2">
      <label htmlFor={name} className="text-body-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${name}-hint`} className="type-meta">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  error,
  ...input
}: ShellProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      <input
        id={name}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        {...input}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  error,
  ...textarea
}: ShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      <textarea
        id={name}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        {...textarea}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  error,
  options,
  ...select
}: ShellProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string }[];
  }) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      <select
        id={name}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  error,
  ...input
}: ShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div className="stack gap-2">
      <label className="flex cursor-pointer items-center gap-3 text-body-sm">
        <input
          type="checkbox"
          name={name}
          className="check"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, hint, error)}
          {...input}
        />
        {label}
      </label>
      {hint && (
        <p id={`${name}-hint`} className="type-meta">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** The form-wide result line: the action's error, or a saved notice. */
export function FormStatus({
  error,
  saved,
}: {
  error?: string | null;
  saved?: string;
}) {
  if (error) {
    return (
      <p role="alert" className="text-body-sm text-danger">
        {error}
      </p>
    );
  }
  return (
    <p role="status" className="text-body-sm text-success empty:hidden">
      {saved}
    </p>
  );
}
