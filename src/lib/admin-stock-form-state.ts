/*
 * Constants the stock forms share with their actions. Outside
 * admin-stock-actions.ts because a "use server" module may only export async
 * functions, and free of DB imports because client components import it.
 * The forms use AdminFormState from admin-form-state.ts.
 */

/** Highest count an admin may set or adjust to. */
export const MAX_STOCK = 100_000;

/** Reasons an admin may record; sale, refund and oversell come from orders. */
export const adminStockReasons = ["restock", "correction"] as const;
export type AdminStockReason = (typeof adminStockReasons)[number];

export const adminStockReasonLabels: Record<AdminStockReason, string> = {
  restock: "Restock",
  correction: "Correction",
};
