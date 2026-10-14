"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fulfillmentStatuses, orders } from "@/db/schema";
import {
  FIELD_ERRORS_MESSAGE,
  submittedValues,
  type AdminFormState,
} from "@/lib/admin-form-state";
import {
  fulfillmentIntents,
  fulfillmentMoves,
  MAX_CARRIER_LENGTH,
  MAX_TRACKING_LENGTH,
} from "@/lib/admin-order-form-state";
import { field, readOneOf, readText, readUuid } from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";

/*
 * Fulfilment writes for one order. Like every admin action this checks the
 * admin and every field itself: Server Actions can be POSTed to directly.
 *
 * The form carries the status the admin saw (`expected`). The update only
 * applies while the row still has that status, so two admins (or two tabs)
 * can't both move an order, and a stale page can't undo a newer change.
 */

const CHANGED =
  "This order changed since you loaded it. Reload and try again.";

export async function updateFulfillment(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const values = submittedValues(formData);
  const rawId = typeof values.orderId === "string" ? values.orderId : "";
  await requireAdmin(`/admin/orders/${encodeURIComponent(rawId)}`);

  const id = readUuid(formData, "orderId");
  const intent = readOneOf(formData, "intent", fulfillmentIntents);
  const expected = readOneOf(formData, "expected", fulfillmentStatuses);
  if (!id.ok || !intent.ok || !expected.ok) {
    return { error: "This request isn't valid. Reload and try again.", values };
  }

  const move = fulfillmentMoves[intent.value];
  if (expected.value !== move.from) {
    return { error: "That change isn't allowed for this order.", values };
  }

  // Carrier and tracking only matter when shipping or editing tracking.
  const errors: Record<string, string> = {};
  const withTracking = intent.value === "ship" || intent.value === "tracking";
  const carrier = withTracking
    ? field(
        errors,
        "carrier",
        readText(formData, "carrier", {
          max: MAX_CARRIER_LENGTH,
          optional: true,
        }),
      )
    : undefined;
  const trackingNumber = withTracking
    ? field(
        errors,
        "tracking",
        readText(formData, "tracking", {
          max: MAX_TRACKING_LENGTH,
          optional: true,
        }),
      )
    : undefined;
  if (Object.keys(errors).length) {
    return { error: FIELD_ERRORS_MESSAGE, fieldErrors: errors, values };
  }

  const set = {
    ship: {
      fulfillmentStatus: "shipped" as const,
      carrier,
      trackingNumber,
      shippedAt: sql`now()`,
    },
    tracking: { carrier, trackingNumber },
    deliver: {
      fulfillmentStatus: "delivered" as const,
      deliveredAt: sql`now()`,
    },
    cancel: { fulfillmentStatus: "cancelled" as const },
  }[intent.value];

  const updated = await db
    .update(orders)
    .set(set)
    .where(and(eq(orders.id, id.value), eq(orders.fulfillmentStatus, move.from)))
    .returning({ id: orders.id });
  if (updated.length === 0) return { error: CHANGED, values };

  revalidatePath(`/admin/orders/${id.value}`);
  revalidatePath("/admin/orders");
  // The customer sees the status and tracking on their account.
  revalidatePath("/account");
  return { error: null, saved: move.saved };
}
