import type { FulfillmentStatus } from "@/db/schema";

/*
 * Labels and badge tones for orders.fulfillment_status. Type-only import
 * from the schema, so client components can use this too.
 */

export const fulfillmentLabels: Record<FulfillmentStatus, string> = {
  unfulfilled: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** For `.badge[data-tone]`; undefined is the plain ink badge. */
export const fulfillmentTones: Record<
  FulfillmentStatus,
  "muted" | "danger" | "success" | undefined
> = {
  unfulfilled: "muted",
  shipped: undefined,
  delivered: "success",
  cancelled: "danger",
};
