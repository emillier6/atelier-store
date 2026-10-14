"use client";

import { type FormEvent, startTransition, useActionState, useState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormStatus, TextField } from "@/components/admin/form-fields";
import {
  centsToInput,
  formatCents,
  inputToCents,
} from "@/components/admin/orders/refund-format";
import { emptyAdminState } from "@/lib/admin-form-state";
import { refundOrderAction } from "@/lib/admin-refund-actions";

/*
 * Submits manually (onSubmit + startTransition) so React doesn't reset the
 * form after a failed refund. The amount field is keyed on the refunded
 * total, so once a refund lands it remounts with the new remaining amount
 * and the confirm step closes.
 */

type RefundFormProps = {
  orderId: string;
  refundedCents: number;
  remainingCents: number;
};

export function RefundForm({
  orderId,
  refundedCents,
  remainingCents,
}: RefundFormProps) {
  const [state, action, pending] = useActionState(
    refundOrderAction,
    emptyAdminState,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={submit} className="stack gap-4" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      {/* What the admin saw: the refund only goes ahead if it still matches. */}
      <input type="hidden" name="refundedCents" value={refundedCents} />
      <AmountAndConfirm
        key={refundedCents}
        defaultAmount={state.values?.amount ?? centsToInput(remainingCents)}
        remainingCents={remainingCents}
        error={state.fieldErrors?.amount}
        pending={pending}
      />
      <FormStatus error={state.error} saved={state.saved} />
    </form>
  );
}

function AmountAndConfirm({
  defaultAmount,
  remainingCents,
  error,
  pending,
}: {
  defaultAmount: string;
  remainingCents: number;
  error?: string;
  pending: boolean;
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const cents = inputToCents(amount);
  const label =
    cents !== null && cents >= 1 ? `Refund ${formatCents(cents)}` : "Refund";

  return (
    <>
      <TextField
        name="amount"
        label="Amount (USD)"
        inputMode="decimal"
        autoComplete="off"
        required
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={error}
        hint={`From $0.01 to ${formatCents(remainingCents)}.`}
      />
      <ConfirmButton
        label={label}
        question={`${label} through Stripe? This can't be undone.`}
        confirmLabel={label}
        pending={pending}
      />
    </>
  );
}
