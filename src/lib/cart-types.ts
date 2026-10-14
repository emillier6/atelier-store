import type { Media } from "@/lib/catalog";

/*
 * The bag's shapes, apart from src/lib/cart.ts (server-only) so client
 * components can import them. Amounts are in cents.
 */

/** The most of one piece, in one size, a customer can buy in an order. */
export const MAX_QUANTITY = 10;

export type BagLine = {
  /** cart_items.id: the handle the quantity and remove forms post back. */
  id: string;
  productId: string;
  slug: string;
  name: string;
  color: string;
  size: string | null;
  image: Media | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Units in stock now, shared by every size of the product. */
  stock: number;
  /** The product was drafted or archived: it can only be removed. */
  inactive: boolean;
  /**
   * Checkout would fail as the bag stands: the product is inactive or sold
   * out, or all its lines together (every size) ask for more than `stock`.
   */
  unavailable: boolean;
};

export type Bag = {
  lines: BagLine[];
  subtotalCents: number;
  itemCount: number;
};

export const emptyBag: Bag = { lines: [], subtotalCents: 0, itemCount: 0 };

