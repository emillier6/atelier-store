import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts, productImages, products } from "@/db/schema";
import { type Bag, type BagLine, emptyBag } from "@/lib/cart-types";

/*
 * The bag's queries. Pages and actions go through here, never through db,
 * the same way src/lib/products.ts owns the catalogue.
 */

/**
 * Insert-or-nothing, then read back: two concurrent first adds would both
 * see no cart with select-then-insert. The unique user_id settles the race.
 */
async function getOrCreateCartId(userId: string) {
  await db
    .insert(carts)
    .values({ userId })
    .onConflictDoNothing({ target: carts.userId });
  const [row] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, userId));
  return row.id;
}

/** The customer's bag, priced from products.price_cents as it is now. */
export async function getBag(userId: string): Promise<Bag> {
  const cart = await db.query.carts.findFirst({
    where: eq(carts.userId, userId),
    with: {
      items: {
        orderBy: asc(cartItems.createdAt),
        with: {
          product: {
            with: { images: { orderBy: asc(productImages.position), limit: 1 } },
          },
        },
      },
    },
  });
  if (!cart) return emptyBag;

  // Stock belongs to the product, so every size of it draws on one count.
  const wanted = new Map<string, number>();
  for (const item of cart.items) {
    wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + item.quantity);
  }

  const lines: BagLine[] = cart.items.map(({ product, ...item }) => {
    const [image] = product.images;
    return {
      id: item.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      color: product.colour,
      size: item.size,
      image: image ? { src: image.url, alt: image.alt } : null,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
      lineTotalCents: product.priceCents * item.quantity,
      stock: product.stockQuantity,
      unavailable:
        product.stockQuantity <= 0 ||
        (wanted.get(item.productId) ?? 0) > product.stockQuantity,
    };
  });

  return {
    lines,
    subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/** What Add to bag needs to check a request: never sent to the browser. */
export async function getProductForBag(slug: string) {
  const [row] = await db
    .select({
      id: products.id,
      sizes: products.sizes,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(eq(products.slug, slug));
  return row;
}

/**
 * Adds a piece, or bumps the line with the same size, never past `cap`.
 * The unique (cart_id, product_id, size) is the conflict target.
 */
export async function addItem(
  userId: string,
  item: { productId: string; size: string | null; quantity: number },
  cap: number,
) {
  const cartId = await getOrCreateCartId(userId);
  await db
    .insert(cartItems)
    .values({ cartId, ...item, quantity: Math.min(item.quantity, cap) })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId, cartItems.size],
      set: {
        quantity: sql`least(${cartItems.quantity} + ${item.quantity}, ${cap})`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Line writes match the item id *and* the caller's cart, so an id forged in
 * a direct POST can't touch someone else's bag.
 */
function ownLine(userId: string, itemId: string) {
  return and(
    eq(cartItems.id, itemId),
    eq(
      cartItems.cartId,
      sql`(select c.id from carts c where c.user_id = ${userId})`,
    ),
  );
}

export async function setQuantity(
  userId: string,
  itemId: string,
  quantity: number,
) {
  await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(ownLine(userId, itemId));
}

export async function removeItem(userId: string, itemId: string) {
  await db.delete(cartItems).where(ownLine(userId, itemId));
}
