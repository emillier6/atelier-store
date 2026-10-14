import "server-only";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

/*
 * Refunds. Stripe is the record of what was refunded: orders.refunded_cents
 * mirrors the charge's amount_refunded and is written two ways, by the
 * charge.refunded webhook (any refund, including ones made in the Dashboard)
 * and right after an admin refunds here, so the panel updates without
 * waiting for the webhook. Both use recordRefundedAmount, which only ever
 * raises the total, so redelivered or out-of-order events can't lower it.
 */

/** Pages that show an order's refund: the admin list and page, /account. */
export function refundPaths(orderId: string) {
  return ["/admin/orders", `/admin/orders/${orderId}`, "/account"];
}

/**
 * Records a charge's cumulative amount_refunded on the order paid by this
 * PaymentIntent, in one statement. refunded_at moves only when the total
 * rises. Returns the ids of the orders it matched (none for a payment that
 * isn't from this store).
 */
export async function recordRefundedAmount(
  paymentIntentId: string,
  amountRefunded: number,
) {
  const capped = sql`least(${Math.max(0, Math.trunc(amountRefunded))}::integer, ${orders.totalCents})`;
  const rows = await db
    .update(orders)
    .set({
      refundedCents: sql`greatest(${orders.refundedCents}, ${capped})`,
      // Right-hand sides see the row as it was before this update.
      refundedAt: sql`case when ${capped} > ${orders.refundedCents} then now() else ${orders.refundedAt} end`,
    })
    .where(eq(orders.stripePaymentIntentId, paymentIntentId))
    .returning({ id: orders.id });
  return rows.map((row) => row.id);
}

/**
 * The charge.refunded webhook. Returns the paths to revalidate; an unknown
 * PaymentIntent is logged and ignored.
 */
export async function recordChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!paymentIntentId) {
    console.info("charge.refunded without a PaymentIntent", charge.id);
    return [];
  }

  const orderIds = await recordRefundedAmount(
    paymentIntentId,
    charge.amount_refunded,
  );
  if (orderIds.length === 0) {
    console.info("charge.refunded for no known order", charge.id);
    return [];
  }
  return orderIds.flatMap(refundPaths);
}

type RefundableOrder = {
  id: string;
  totalCents: number;
  refundedCents: number;
  refundedAt: Date | null;
  stripePaymentIntentId: string | null;
};

const refundColumns = {
  id: true,
  totalCents: true,
  refundedCents: true,
  refundedAt: true,
  stripePaymentIntentId: true,
} as const;

async function findRefundableOrder(
  orderId: string,
): Promise<RefundableOrder | undefined> {
  return db.query.orders.findFirst({
    columns: refundColumns,
    where: eq(orders.id, orderId),
  });
}

export type RefundPanelData = RefundableOrder & {
  remainingCents: number;
  /** Products still in the catalogue, for the restock note. */
  products: { id: string; name: string }[];
};

/** The admin order page's refund panel. Checks the admin itself. */
export async function getRefundPanel(
  orderId: string,
): Promise<RefundPanelData | null> {
  await requireAdmin(`/admin/orders/${orderId}`);

  const [order, lines] = await Promise.all([
    findRefundableOrder(orderId),
    db
      .selectDistinctOn([orderItems.productId], {
        id: orderItems.productId,
        name: orderItems.name,
      })
      .from(orderItems)
      .where(
        and(eq(orderItems.orderId, orderId), isNotNull(orderItems.productId)),
      )
      .orderBy(asc(orderItems.productId)),
  ]);
  if (!order) return null;

  return {
    ...order,
    remainingCents: Math.max(0, order.totalCents - order.refundedCents),
    products: lines.flatMap((line) =>
      line.id ? [{ id: line.id, name: line.name }] : [],
    ),
  };
}

export type RefundResult =
  | { ok: true; amountCents: number; refundedCents: number; pending: boolean }
  | { ok: false; error: string; field?: "amount" };

/**
 * Refunds part or all of an order through Stripe, then records the charge's
 * new total. The remaining amount is re-read here, never taken from the
 * form, and the refund only goes ahead if the refunded total is still what
 * the admin saw, so a refund recorded meanwhile (by the webhook, or another
 * admin) makes them look again instead of refunding twice. The idempotency
 * key is order id + refunded-so-far + amount: a double submit, or a retry
 * after a lost response, gets the first refund back from Stripe instead of
 * making a second.
 */
export async function refundOrder({
  orderId,
  amountCents,
  seenRefundedCents,
}: {
  orderId: string;
  amountCents: number;
  /** refunded_cents when the admin loaded the page. */
  seenRefundedCents: number;
}): Promise<RefundResult> {
  // Moves money: checks for itself rather than trusting its caller to.
  await requireAdmin(`/admin/orders/${orderId}`);
  const order = await findRefundableOrder(orderId);
  if (!order) return { ok: false, error: "This order no longer exists." };
  const paymentIntentId = order.stripePaymentIntentId;
  if (!paymentIntentId) {
    return { ok: false, error: "This order has no Stripe payment to refund." };
  }

  const remaining = order.totalCents - order.refundedCents;
  if (remaining <= 0) {
    return { ok: false, error: "This order is already fully refunded." };
  }
  if (order.refundedCents !== seenRefundedCents) {
    return {
      ok: false,
      error: "A refund was recorded since you loaded the page. Check the amounts and try again.",
    };
  }
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    return { ok: false, error: "Enter at least $0.01.", field: "amount" };
  }
  if (amountCents > remaining) {
    return {
      ok: false,
      error: "That's more than is left to refund.",
      field: "amount",
    };
  }

  const stripe = getStripe();
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: amountCents,
        metadata: { order_id: order.id },
        expand: ["charge"],
      },
      {
        idempotencyKey: `refund:${order.id}:${order.refundedCents}:${amountCents}`,
      },
    );
  } catch (error) {
    console.error("Stripe refund failed", order.id, error);
    return { ok: false, error: stripeRefundMessage(error) };
  }

  if (refund.status === "failed" || refund.status === "canceled") {
    return {
      ok: false,
      error: "Stripe couldn't make this refund. Check the payment in Stripe.",
    };
  }

  // The charge's cumulative total, so this also catches up on refunds made
  // elsewhere. If reading it fails, the webhook records it shortly.
  let refundedCents = order.refundedCents + amountCents;
  try {
    const charge = await refundCharge(stripe, refund, paymentIntentId);
    if (charge) {
      await recordRefundedAmount(paymentIntentId, charge.amount_refunded);
      refundedCents = Math.min(charge.amount_refunded, order.totalCents);
    }
  } catch (error) {
    console.error("Recording refund failed; the webhook will", order.id, error);
  }

  return {
    ok: true,
    amountCents,
    refundedCents,
    pending: refund.status === "pending" || refund.status === "requires_action",
  };
}

async function refundCharge(
  stripe: Stripe,
  refund: Stripe.Refund,
  paymentIntentId: string,
): Promise<Stripe.Charge | null> {
  if (refund.charge && typeof refund.charge !== "string") return refund.charge;
  if (typeof refund.charge === "string") {
    return stripe.charges.retrieve(refund.charge);
  }
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  return intent.latest_charge && typeof intent.latest_charge !== "string"
    ? intent.latest_charge
    : null;
}

function stripeRefundMessage(error: unknown) {
  const stripeError = error as Partial<Stripe.errors.StripeError> | null;
  switch (stripeError?.code) {
    case "charge_already_refunded":
      return "Stripe says this payment is already fully refunded. The page updates once Stripe's event arrives.";
    case "amount_too_large":
      return "That's more than Stripe has left to refund. Someone may have refunded it in the Dashboard; reload and try again.";
    case "charge_disputed":
      return "This payment is disputed, so it can't be refunded. Handle it in the Stripe Dashboard.";
  }
  switch (stripeError?.type) {
    case "StripeIdempotencyError":
      return "A different refund was just started for this order. Reload the page and try again.";
    case "StripeConnectionError":
    case "StripeAPIError":
    case "StripeRateLimitError":
      // The refund may or may not have gone through; the same key makes a
      // retry return it instead of refunding again.
      return "Couldn't confirm the refund with Stripe. Submitting again is safe: it can't refund twice.";
    case "StripeAuthenticationError":
    case "StripePermissionError":
      return "The store's Stripe key can't make refunds. Check the Stripe settings.";
    case "StripeInvalidRequestError":
      return stripeError.message
        ? `Stripe refused the refund: ${stripeError.message}`
        : "Stripe refused the refund.";
  }
  return "The refund failed. Check the payment in Stripe before trying again.";
}
