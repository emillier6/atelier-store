import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts, productImages, products } from "@/db/schema";
import {
  type Bag,
  type BagLine,
  emptyBag,
  MAX_QUANTITY,
} from "@/lib/cart-types";

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
 * Adds a piece, or bumps the line with the same size. Stock is one count per
 * product, so the cap is min(MAX_QUANTITY, stock - the other sizes already in
 * this bag), worked out inside the upsert rather than read first and written
 * after. Returns false when there was no room left, so nothing changed.
 * The unique (cart_id, product_id, size) is the conflict target.
 */
export async function addItem(
  userId: string,
  item: { productId: string; size: string | null; quantity: number },
) {
  const cartId = await getOrCreateCartId(userId);
  // Raw SQL: Drizzle's insert-select wants every column, defaults included.
  const result = await db.execute(sql`
    with cap as (
      select least(
        ${MAX_QUANTITY}::int,
        p.stock_quantity - coalesce((
          select sum(ci.quantity)::int from cart_items ci
          where ci.cart_id = ${cartId}::uuid
            and ci.product_id = p.id
            and ci.size is distinct from ${item.size}::text
        ), 0)
      ) as n
      from products p where p.id = ${item.productId}::uuid
    )
    insert into cart_items (cart_id, product_id, size, quantity)
    select ${cartId}::uuid, ${item.productId}::uuid, ${item.size}::text,
      least(${item.quantity}::int, cap.n)
    from cap where cap.n >= 1
    on conflict (cart_id, product_id, size) do update
      set quantity = least(
            cart_items.quantity + excluded.quantity, (select n from cap)
          ),
          updated_at = now()
      where cart_items.quantity < (select n from cap)
    returning cart_items.id
  `);
  return result.rows.length > 0;
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

/**
 * Sets a line's quantity unless the product's total across every size in
 * this bag would pass min(MAX_QUANTITY, stock). Lowering is always allowed,
 * so a bag that went over stock can be brought back down. One UPDATE, so the
 * check reads the same rows it writes. Returns false when nothing changed.
 */
export async function setQuantity(
  userId: string,
  itemId: string,
  quantity: number,
) {
  const rows = await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(
      and(
        ownLine(userId, itemId),
        sql`(${quantity} <= ${cartItems.quantity} or ${quantity} <= least(
          ${MAX_QUANTITY}::int,
          (select p.stock_quantity from products p
            where p.id = ${cartItems.productId})
          - coalesce((
            select sum(ci.quantity)::int from cart_items ci
            where ci.cart_id = ${cartItems.cartId}
              and ci.product_id = ${cartItems.productId}
              and ci.id <> ${cartItems.id}
          ), 0)
        ))`,
      ),
    )
    .returning({ id: cartItems.id });
  return rows.length > 0;
}

export async function removeItem(userId: string, itemId: string) {
  await db.delete(cartItems).where(ownLine(userId, itemId));
}
