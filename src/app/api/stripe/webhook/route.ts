import type Stripe from "stripe";
import { revalidateCatalogue } from "@/lib/catalogue-paths";
import { fulfillCheckoutSession } from "@/lib/orders";
import { recordChargeRefunded } from "@/lib/refunds";
import { getStripe, webhookSecret } from "@/lib/stripe";

/*
 * Stripe's event endpoint, where orders are created and refunds recorded. It
 * carries no cookies, so it must never sit behind a sign-in check.
 */

export async function POST(request: Request) {
  // The raw body: the signature is computed over these exact bytes.
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret(),
    );
  } catch {
    // No payload in the log: an unverified body is attacker-controlled.
    console.warn("Stripe webhook signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  let changedPaths: string[] = [];
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        changedPaths = await fulfillCheckoutSession(event.data.object.id);
        break;
      case "checkout.session.async_payment_failed":
        // No order and the bag is untouched, so the customer can try again.
        console.info("Checkout payment failed", event.data.object.id);
        break;
      case "charge.refunded":
        // Any refund, including Dashboard ones. Records the charge's running
        // total, only ever raised, so redelivered or out-of-order events are
        // harmless. A payment that isn't an order here is logged and skipped.
        changedPaths = await recordChargeRefunded(event.data.object);
        break;
    }
  } catch (error) {
    // 500 makes Stripe retry, which is safe: fulfilment is idempotent.
    console.error("Stripe webhook handler failed", event.type, error);
    return new Response("Handler error", { status: 500 });
  }

  // Outside the try above: the order is written by now, so a failed cache
  // refresh must not answer 500 and make Stripe redeliver. It never throws,
  // and refreshes any path (catalogue pages, or the refunded order's pages).
  revalidateCatalogue(changedPaths);

  return new Response(null, { status: 200 });
}
