import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

/**
 * The Stripe client, built on first use so the storefront still builds and
 * runs without STRIPE_SECRET_KEY; checkout and the webhook fail instead.
 * No apiVersion: the SDK pins the version its types were generated for.
 */
export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key, { appInfo: { name: "atelier-store" } });
  }
  return client;
}

export function webhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  return secret;
}

/** Absolute origin for Stripe's success and cancel URLs. */
export function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set.");
  return url.replace(/\/$/, "");
}

/**
 * A Dashboard link for a PaymentIntent, in the mode of the key in use: live
 * keys (sk_live_) link to live payments, anything else to test mode.
 */
export function stripePaymentUrl(paymentIntentId: string) {
  const live = process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_");
  return `https://dashboard.stripe.com/${live ? "" : "test/"}payments/${encodeURIComponent(paymentIntentId)}`;
}
