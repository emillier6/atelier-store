"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import {
  FormStatus,
  SelectField,
  TextField,
} from "@/components/admin/form-fields";
import { emptyAdminState } from "@/lib/admin-form-state";
import {
  adjustStockAction,
  setStockAction,
} from "@/lib/admin-stock-actions";
import {
  adminStockReasonLabels,
  adminStockReasons,
  MAX_STOCK,
} from "@/lib/admin-stock-form-state";

/*
 * Both forms submit manually (onSubmit + startTransition) instead of
 * <form action>, so React doesn't reset them after the action: a failed
 * submission keeps what the admin typed. Their fields are keyed on the saved
 * stock, so once a change lands they remount with fresh defaults.
 */

type StockFormProps = { productId: string; stock: number };

function useStockForm(
  serverAction: typeof setStockAction | typeof adjustStockAction,
) {
  const [state, action, pending] = useActionState(serverAction, emptyAdminState);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }
  return { state, submit, pending };
}

export function SetStockForm({ productId, stock }: StockFormProps) {
  const { state, submit, pending } = useStockForm(setStockAction);

  return (
    <form onSubmit={submit} className="stack gap-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      {/* What the admin saw: the write only applies if stock still matches. */}
      <input type="hidden" name="expected" value={stock} />
      <TextField
        key={stock}
        name="quantity"
        label="Set stock to"
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_STOCK}
        step={1}
        required
        defaultValue={state.values?.quantity ?? String(stock)}
        error={state.fieldErrors?.quantity}
        hint="After a count. Recorded as a correction."
      />
      <div className="cluster gap-4">
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={pending}
        >
          {pending ? "Saving…" : "Set stock"}
        </button>
        <FormStatus error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function AdjustStockForm({ productId, stock }: StockFormProps) {
  const { state, submit, pending } = useStockForm(adjustStockAction);

  return (
    <form onSubmit={submit} className="stack gap-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <TextField
        key={`delta-${stock}`}
        name="delta"
        label="Add or remove"
        type="number"
        inputMode="numeric"
        min={-MAX_STOCK}
        max={MAX_STOCK}
        step={1}
        required
        placeholder="e.g. 12 or -2"
        defaultValue={state.values?.delta ?? ""}
        error={state.fieldErrors?.delta}
        hint="Use a minus sign to remove pieces."
      />
      <SelectField
        key={`reason-${stock}`}
        name="reason"
        label="Reason"
        defaultValue={state.values?.reason ?? "restock"}
        error={state.fieldErrors?.reason}
        options={adminStockReasons.map((reason) => ({
          value: reason,
          label: adminStockReasonLabels[reason],
        }))}
      />
      <div className="cluster gap-4">
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={pending}
        >
          {pending ? "Saving…" : "Apply"}
        </button>
        <FormStatus error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
