import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
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

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown) {
  // Drizzle wraps driver errors, so look at the cause too.
  for (let e = error; e && typeof e === "object"; e = (e as Error).cause) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

export async function fulfillCheckoutSession(sessionId: string) {
  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, sessionId));
  if (existing) return;

  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product"],
  });
  // With delayed payment methods, `completed` arrives before the money does.
  if (session.payment_status === "unpaid") return;

  const userId = session.client_reference_id;
  const stripeLines = session.line_items?.data ?? [];
  if (!userId || stripeLines.length === 0) {
    // What a synthetic `stripe trigger` event looks like; nothing to fulfil.
    console.info("Stripe session has no user or lines, skipped", sessionId);
    return;
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
        with: { images: { orderBy: asc(productImages.position), limit: 1 } },
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
  const statements: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
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
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    // A concurrent delivery wrote this order first.
    if (isUniqueViolation(error)) return;
    throw error;
  }
}
