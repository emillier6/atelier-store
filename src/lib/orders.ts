import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db";
import {
  cartItems,
  orderItems,
  orders,
  productImages,
  products,
} from "@/db/schema";
import { getStripe } from "@/lib/stripe";

/*
 * Orders are written here, from the Stripe webhook, never from the success
 * page: a customer can pay and close the tab before it loads.
 *
 * Fulfilment must be safe to run twice, even at the same time: Stripe
 * retries deliveries and can send both checkout.session.completed and
 * checkout.session.async_payment_succeeded for one session. The unique
 * orders.stripe_checkout_session_id makes the second run a no-op.
 */

/** The customer's order for a Checkout Session, with its lines. */
export const getOrderBySession = cache(
  async (userId: string, sessionId: string) =>
    db.query.orders.findFirst({
      where: and(
        eq(orders.stripeCheckoutSessionId, sessionId),
        eq(orders.userId, userId),
      ),
      with: { items: true },
    }),
);

/** Every order the customer has placed, newest first, with its lines. */
export async function getOrdersForUser(userId: string) {
  return db.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: desc(orders.createdAt),
    with: { items: true },
  });
}

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown) {
  // Drizzle wraps driver errors, so look at the cause too.
  for (let e = error; e && typeof e === "object"; e = (e as Error).cause) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

/**
 * Writes the order for a paid session. Returns the catalogue paths whose
 * stock it changed, or [] when there was nothing new to write.
 */
export async function fulfillCheckoutSession(
  sessionId: string,
): Promise<string[]> {
  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, sessionId));
  if (existing) return [];

  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product"],
  });
  // With delayed payment methods, `completed` arrives before the money does.
  if (session.payment_status === "unpaid") return [];

  const userId = session.client_reference_id;
  const stripeLines = session.line_items?.data ?? [];
  if (!userId || stripeLines.length === 0) {
    // What a synthetic `stripe trigger` event looks like; nothing to fulfil.
    console.info("Stripe session has no user or lines, skipped", sessionId);
    return [];
  }

  // Amounts come from Stripe: what was charged is what the receipt says.
  const bought = stripeLines.map((item) => {
    const product = item.price?.product;
    const metadata =
      product && typeof product === "object" && !product.deleted
        ? product.metadata
        : {};
    return {
      productId: metadata.product_id || null,
      size: metadata.size || null,
      name: item.description ?? "Item",
      unitPriceCents: item.price?.unit_amount ?? 0,
      quantity: item.quantity ?? 1,
      lineTotalCents: item.amount_total,
    };
  });

  const productIds = bought.flatMap((line) =>
    line.productId ? [line.productId] : [],
  );
  const catalogue = productIds.length
    ? await db.query.products.findMany({
        where: inArray(products.id, productIds),
        columns: { id: true, slug: true, name: true, sku: true, colour: true },
        with: {
          images: { orderBy: asc(productImages.position), limit: 1 },
          category: { columns: { slug: true } },
        },
      })
    : [];
  const byId = new Map(catalogue.map((row) => [row.id, row]));

  // neon-http has no interactive transactions, so the id is made here and
  // every statement goes into one db.batch(), which runs as a transaction.
  const orderId = crypto.randomUUID();
  const lines = bought.map((line) => {
    const row = line.productId ? byId.get(line.productId) : undefined;
    return {
      orderId,
      productId: row?.id ?? null,
      productSlug: row?.slug ?? "",
      name: row?.name ?? line.name,
      sku: row?.sku ?? "",
      colour: row?.colour ?? "",
      size: line.size,
      imageUrl: row?.images[0]?.url ?? null,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
    };
  });

  const inCatalogue = lines.filter((line) => line.productId !== null);
  const boughtIds = [...new Set(inCatalogue.map((line) => line.productId!))];
  const results = await runBatch([
    db.insert(orders).values({
      id: orderId,
      userId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      email: session.customer_details?.email ?? session.customer_email ?? "",
      totalCents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
    }),
    db.insert(orderItems).values(lines),
    // Lock the bought rows and read their stock before the decrements, so
    // the value read is exactly what the updates below start from. Id order
    // keeps two concurrent fulfilments from deadlocking.
    db
      .select({ id: products.id, stockQuantity: products.stockQuantity })
      .from(products)
      .where(inArray(products.id, boughtIds))
      .orderBy(asc(products.id))
      .for("update"),
    // Two customers can pass the stock check and both pay; the second
    // decrement stops at 0 rather than going negative.
    ...inCatalogue.map((line) =>
      db
        .update(products)
        .set({
          stockQuantity: sql`greatest(${products.stockQuantity} - ${line.quantity}, 0)`,
        })
        .where(eq(products.id, line.productId!)),
    ),
    // Remove only what was bought: anything added to the bag while the
    // customer was on Stripe's page stays.
    ...inCatalogue.map((line) =>
      db
        .delete(cartItems)
        .where(
          and(
            eq(
              cartItems.cartId,
              sql`(select c.id from carts c where c.user_id = ${userId})`,
            ),
            eq(cartItems.productId, line.productId!),
            sql`${cartItems.size} is not distinct from ${line.size}`,
          ),
        ),
    ),
  ]);
  // A concurrent delivery wrote this order first.
  if (!results) return [];

  // The clamp above hides an oversell, so replay the decrements over the
  // locked stock and log any line that asked for more than was left. The
  // customer has paid, so this only warns. A stock history table may
  // replace this log later.
  const stock = new Map(results[2].map((row) => [row.id, row.stockQuantity]));
  for (const line of inCatalogue) {
    const available = stock.get(line.productId!) ?? 0;
    if (line.quantity > available) {
      console.warn("Oversold at fulfilment", {
        orderId,
        productId: line.productId,
        size: line.size,
        requested: line.quantity,
        available,
      });
    }
    stock.set(line.productId!, Math.max(available - line.quantity, 0));
  }

  // Catalogue pages that show the stock this order just lowered.
  const paths = new Set(["/", "/new-arrivals"]);
  for (const id of boughtIds) {
    const row = byId.get(id)!;
    paths.add(`/products/${row.slug}`);
    paths.add(`/collections/${row.category.slug}`);
  }
  return [...paths];
}

/** db.batch() that resolves to null when the order was already written. */
async function runBatch<T extends [BatchItem<"pg">, ...BatchItem<"pg">[]]>(
  statements: T,
) {
  try {
    return await db.batch(statements);
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}
