import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { fulfillCheckoutSession } from "@/lib/orders";
import { getStripe, webhookSecret } from "@/lib/stripe";

/*
 * Stripe's event endpoint, where orders are created. It carries no cookies,
 * so it must never sit behind a sign-in check.
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
    }
  } catch (error) {
    // 500 makes Stripe retry, which is safe: fulfilment is idempotent.
    console.error("Stripe webhook handler failed", event.type, error);
    return new Response("Handler error", { status: 500 });
  }

  // Outside the try above: the order is written by now, so a failed cache
  // refresh must not answer 500 and make Stripe redeliver. The pages fall
  // back to their 60s revalidate.
  try {
    for (const path of changedPaths) revalidatePath(path);
  } catch (error) {
    console.error("Catalogue revalidation failed", changedPaths, error);
  }

  return new Response(null, { status: 200 });
}
