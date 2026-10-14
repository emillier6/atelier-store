import type { FulfillmentStatus } from "@/db/schema";

/*
 * What the fulfilment forms may ask for, beside admin-order-actions.ts
 * because a "use server" module may only export async functions. No runtime
 * DB imports, so the client forms share it.
 */

export const MAX_CARRIER_LENGTH = 60;
export const MAX_TRACKING_LENGTH = 100;

export const fulfillmentIntents = [
  "ship",
  "tracking",
  "deliver",
  "cancel",
] as const;
export type FulfillmentIntent = (typeof fulfillmentIntents)[number];

/**
 * The only allowed moves: each intent applies to one status. Updating
 * tracking keeps the order shipped.
 */
export const fulfillmentMoves: Record<
  FulfillmentIntent,
  { from: FulfillmentStatus; saved: string }
> = {
  ship: { from: "unfulfilled", saved: "Marked as shipped." },
  tracking: { from: "shipped", saved: "Tracking saved." },
  deliver: { from: "shipped", saved: "Marked as delivered." },
  cancel: { from: "unfulfilled", saved: "Order cancelled." },
};
