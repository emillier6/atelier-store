"use client";

import { useActionState } from "react";
import { emptyCartState } from "@/lib/cart-form-state";
import { startCheckout } from "@/lib/checkout";

/** Posts an empty form: the action rebuilds the order from the database. */
export function CheckoutButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(startCheckout, emptyCartState);

  return (
    <form action={action} className="stack gap-3">
      {state.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || pending}
        className="btn btn-primary btn-block"
      >
        {pending ? "Opening checkout…" : "Check out"}
      </button>
    </form>
  );
}
