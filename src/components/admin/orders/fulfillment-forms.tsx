"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormStatus, TextField } from "@/components/admin/form-fields";
import type { FulfillmentStatus } from "@/db/schema";
import { updateFulfillment } from "@/lib/admin-order-actions";
import { emptyAdminState } from "@/lib/admin-form-state";
import {
  type FulfillmentIntent,
  MAX_CARRIER_LENGTH,
  MAX_TRACKING_LENGTH,
} from "@/lib/admin-order-form-state";

/*
 * The moves an admin can make from the order's current status. Every form
 * posts the status the admin saw (`expected`), so the action refuses a move
 * when someone else got there first.
 *
 * Forms submit manually (onSubmit + startTransition) instead of
 * <form action>, so React doesn't reset them after the action and a failed
 * submission keeps what was typed. The fields are keyed on the saved values,
 * so once a change lands they remount with the new defaults. The action
 * state lives up here, unkeyed, so the saved notice survives that remount.
 */

type FulfillmentFormsProps = {
  orderId: string;
  status: FulfillmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
};

export function FulfillmentForms({
  orderId,
  status,
  carrier,
  trackingNumber,
}: FulfillmentFormsProps) {
  const [state, action, pending] = useActionState(
    updateFulfillment,
    emptyAdminState,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  // Echo the last submission only after an error; after a save, show the
  // saved values.
  const echo = state.error ? state.values : undefined;

  // Plain functions, not components: a component defined in render would
  // remount (and lose what was typed) on every render.
  function hidden(intent: FulfillmentIntent) {
    return (
      <>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="expected" value={status} />
      </>
    );
  }

  function trackingFields() {
    return (
      <div
        key={`${status}|${carrier ?? ""}|${trackingNumber ?? ""}`}
        className="stack gap-4"
      >
        <TextField
          name="carrier"
          label="Carrier"
          maxLength={MAX_CARRIER_LENGTH}
          defaultValue={echo?.carrier ?? carrier ?? ""}
          error={state.fieldErrors?.carrier}
          hint="Optional, e.g. UPS."
          autoComplete="off"
        />
        <TextField
          name="tracking"
          label="Tracking number"
          maxLength={MAX_TRACKING_LENGTH}
          defaultValue={echo?.tracking ?? trackingNumber ?? ""}
          error={state.fieldErrors?.tracking}
          hint="Optional. The customer sees it on their account."
          autoComplete="off"
        />
      </div>
    );
  }

  const result = <FormStatus error={state.error} saved={state.saved} />;

  if (status === "unfulfilled") {
    return (
      <div className="stack gap-8">
        <form onSubmit={submit} className="stack gap-4" noValidate>
          {hidden("ship")}
          {trackingFields()}
          <button
            type="submit"
            className="btn btn-primary btn-sm self-start"
            disabled={pending}
          >
            {pending ? "Saving…" : "Mark as shipped"}
          </button>
        </form>
        <form onSubmit={submit} className="stack gap-3">
          {hidden("cancel")}
          <ConfirmButton
            label="Cancel order"
            question="Cancel this order? The payment is not refunded automatically: refund it below or in Stripe."
            confirmLabel="Cancel order"
            pending={pending}
          />
        </form>
        {result}
      </div>
    );
  }

  if (status === "shipped") {
    return (
      <div className="stack gap-8">
        <form onSubmit={submit} className="stack gap-4" noValidate>
          {hidden("tracking")}
          {trackingFields()}
          <button
            type="submit"
            className="btn btn-outline btn-sm self-start"
            disabled={pending}
          >
            {pending ? "Saving…" : "Update tracking"}
          </button>
        </form>
        <form onSubmit={submit}>
          {hidden("deliver")}
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={pending}
          >
            {pending ? "Saving…" : "Mark as delivered"}
          </button>
        </form>
        {result}
      </div>
    );
  }

  return (
    <div className="stack gap-3">
      <p className="type-meta">
        {status === "delivered"
          ? "Delivered. There is nothing left to do."
          : "Cancelled. Refund the payment below if you haven't."}
      </p>
      {result}
    </div>
  );
}
