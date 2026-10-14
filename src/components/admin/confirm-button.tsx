"use client";

import { useState } from "react";

type ConfirmButtonProps = {
  /** The first button, e.g. "Delete". */
  label: string;
  /** The question shown on the second step. */
  question: string;
  /** The submitting button, e.g. "Delete for good". */
  confirmLabel: string;
  pending?: boolean;
};

/**
 * A two-step submit for destructive actions, inside the action's own form.
 * The first click asks; only the second submits. No browser dialog. The
 * action still checks everything on the server.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  pending = false,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="cluster gap-3" role="group" aria-label={question}>
      <p className="text-body-sm">{question}</p>
      <button
        type="submit"
        className="btn btn-sm border-danger bg-danger text-paper"
        disabled={pending}
      >
        {pending ? "Working…" : confirmLabel}
      </button>
      <button
        type="button"
        className="link text-body-sm cursor-pointer"
        onClick={() => setAsking(false)}
        disabled={pending}
      >
        Cancel
      </button>
    </div>
  );
}
