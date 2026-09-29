"use server";

import { redirect } from "next/navigation";
import { getBag } from "@/lib/cart";
import type { CartFormState } from "@/lib/cart-form-state";
import { requireUser } from "@/lib/session";
import { appUrl, getStripe } from "@/lib/stripe";

/**
 * Starts a Stripe-hosted Checkout Session for the caller's bag. The form
 * posts nothing: every amount and quantity is read again from the database
 * here, so nothing about money comes from the browser.
 */
/**
 * Labels our sessions in the Stripe Dashboard. A fixed value on purpose:
 * one generated per request would put every session in its own bucket.
 */
const INTEGRATION_IDENTIFIER = "atelier_hosted_rmfqkzwt";

export async function startCheckout(): Promise<CartFormState> {
  const user = await requireUser("/bag");
  const bag = await getBag(user.id);

  if (bag.lines.length === 0) return { error: "Your bag is empty." };
  // The same fresh read the prices came from, so a piece that sold out
  // while the bag sat open never reaches Stripe.
  const unavailable = bag.lines.find((line) => line.unavailable);
  if (unavailable) {
    return {
      error: `${unavailable.name} is no longer available in that quantity. Update your bag to check out.`,
    };
  }

  let url: string | null;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: bag.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: "usd",
          unit_amount: line.unitPriceCents,
          product_data: {
            name: line.name,
            description: line.size
              ? `${line.color}, size ${line.size}`
              : line.color,
            images: line.image ? [line.image.src] : undefined,
            // How the webhook maps Stripe's lines back to the bag and catalogue.
            metadata: { product_id: line.productId, size: line.size ?? "" },
          },
        },
      })),
      customer_email: user.email,
      client_reference_id: user.id,
      // {CHECKOUT_SESSION_ID} is filled in by Stripe; keep it literal.
      success_url: `${appUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/bag?cancelled=1`,
      integration_identifier: INTEGRATION_IDENTIFIER,
      // No payment_method_types: leaving it out enables the payment methods
      // configured in the Stripe Dashboard.
    });
    url = session.url;
  } catch (error) {
    console.error("Could not create a Stripe Checkout Session", error);
    url = null;
  }

  if (!url) return { error: "Checkout could not start. Try again in a moment." };
  // Outside the try: redirect() throws to navigate.
  redirect(url);
}
