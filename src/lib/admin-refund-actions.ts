"use server";

import { revalidatePath } from "next/cache";
import { formatCents } from "@/components/admin/orders/refund-format";
import {
  type AdminFormState,
  FIELD_ERRORS_MESSAGE,
  submittedValues,
} from "@/lib/admin-form-state";
import { field, readCents, readInt, readUuid } from "@/lib/form-data";
import { refundOrder, refundPaths } from "@/lib/refunds";
import { requireAdmin } from "@/lib/session";

/*
 * The admin order page's Refund form. Actions can be POSTed to directly, so
 * every field is checked here and the remaining amount is re-read from the
 * order in refundOrder; the Stripe call and the write live in
 * src/lib/refunds.ts.
 */

export async function refundOrderAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin("/admin/orders");
  const values = submittedValues(formData);

  const orderId = readUuid(formData, "orderId");
  if (!orderId.ok) return { error: "This order no longer exists.", values };
  const seen = readInt(formData, "refundedCents", { min: 0, max: Infinity });
  if (!seen.ok) return { error: "Reload the page and try again.", values };

  const errors: Record<string, string> = {};
  const amount = field(errors, "amount", readCents(formData, "amount"));
  if (amount !== undefined && amount < 1) {
    errors.amount = "Enter at least $0.01.";
  }
  if (amount === undefined || errors.amount) {
    return { error: FIELD_ERRORS_MESSAGE, fieldErrors: errors, values };
  }

  const result = await refundOrder({
    orderId: orderId.value,
    amountCents: amount,
    seenRefundedCents: seen.value,
  });
  for (const path of refundPaths(orderId.value)) revalidatePath(path);

  if (!result.ok) {
    return result.field
      ? {
          error: FIELD_ERRORS_MESSAGE,
          fieldErrors: { [result.field]: result.error },
          values,
        }
      : { error: result.error, values };
  }
  return {
    error: null,
    saved: result.pending
      ? `Refund of ${formatCents(result.amountCents)} started; Stripe shows it as pending.`
      : `Refunded ${formatCents(result.amountCents)}.`,
  };
}
