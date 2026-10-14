import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { cache } from "react";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db";
import {
  cartItems,
  orderItems,
  orders,
  productImages,
  products,
  type StockAdjustmentReason,
  stockAdjustments,
  user,
} from "@/db/schema";
import { cataloguePaths } from "@/lib/catalogue-paths";
import { UUID_PATTERN } from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";
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
    // Lock the bought rows before anything reads their stock, so the reads
    // below see exactly what the updates start from. Id order keeps two
    // concurrent fulfilments from deadlocking.
    db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, boughtIds))
      .orderBy(asc(products.id))
      .for("update"),
    // Per line: record the change, then make it. The history row reads the
    // stock before this line's update but after the previous line's, so two
    // sizes of one product chain correctly. Two customers can pass the stock
    // check and both pay; the decrement stops at 0 rather than going
    // negative, and the shortfall is recorded as an 'oversell'.
    ...inCatalogue.flatMap((line) => [
      recordSale(line.productId!, line.quantity, orderId),
      db
        .update(products)
        .set({
          stockQuantity: sql`greatest(${products.stockQuantity} - ${line.quantity}::int, 0)`,
        })
        .where(eq(products.id, line.productId!)),
    ]),
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

  // The clamp above hides an oversell from the customer, who has paid; the
  // history row records it, and this log is the cheap alert.
  inCatalogue.forEach((line, i) => {
    const [adjustment] = results[3 + i * 2] as SaleAdjustment[];
    if (adjustment?.reason === "oversell") {
      console.warn("Oversold at fulfilment", {
        orderId,
        productId: line.productId,
        size: line.size,
        requested: line.quantity,
        available: -adjustment.delta,
      });
    }
  });

  // Catalogue pages that show the stock this order just lowered.
  const rows = boughtIds.map((id) => byId.get(id)!);
  return cataloguePaths({
    productSlugs: rows.map((row) => row.slug),
    categorySlugs: rows.map((row) => row.category.slug),
  });
}

type SaleAdjustment = { delta: number; reason: StockAdjustmentReason };

/**
 * The stock_adjustments row for one sold line, computed in SQL from the
 * product's current (locked) stock because statements in a batch can't see
 * each other's results: delta is what the update will actually remove, and a
 * line that asked for more than was left is an 'oversell' (delta may be 0).
 */
function recordSale(productId: string, quantity: number, orderId: string) {
  const qty = sql`${quantity}::int`;
  // Drizzle lists every column of the table, in schema order, so the select
  // supplies all eight: id, product_id, delta, stock_after, reason, user_id
  // (null: the webhook), order_id, created_at.
  return db
    .insert(stockAdjustments)
    .select(
      sql`select gen_random_uuid(), p.id, -least(p.stock_quantity, ${qty}),
        greatest(p.stock_quantity - ${qty}, 0),
        case when p.stock_quantity < ${qty} then 'oversell' else 'sale' end,
        null::text, ${orderId}::uuid, now()
      from products p where p.id = ${productId}::uuid`,
    )
    .returning({
      delta: stockAdjustments.delta,
      reason: stockAdjustments.reason,
    });
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

/* ------------------------------------------------------------------------ *
 * Admin (read-only). Each query calls requireAdmin itself.
 * ------------------------------------------------------------------------ */

export const ADMIN_ORDERS_PAGE_SIZE = 25;

/**
 * A position in the (created_at desc, id desc) order. `createdAt` is
 * Postgres's own text for the timestamp, so no microseconds are lost on the
 * way through the URL.
 */
export type OrderCursor = { createdAt: string; id: string };

const TIMESTAMP_TEXT =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:\d{2})?|Z)$/;

/** "<timestamp>_<uuid>", as it goes in ?after= and ?before=. */
export function encodeOrderCursor(cursor: OrderCursor) {
  return `${cursor.createdAt}_${cursor.id}`;
}

/** The cursor in a search param, or null when it is missing or malformed. */
export function parseOrderCursor(raw: unknown): OrderCursor | null {
  if (typeof raw !== "string" || raw.length > 80) return null;
  const split = raw.lastIndexOf("_");
  const createdAt = raw.slice(0, split);
  const id = raw.slice(split + 1).toLowerCase();
  if (split < 0 || !TIMESTAMP_TEXT.test(createdAt) || !UUID_PATTERN.test(id)) {
    return null;
  }
  // The pattern admits "2026-99-99"; Postgres would throw on it. Date.UTC
  // rolls impossible dates over, so a round trip catches them.
  const [y, m, d, h, min, sec] = createdAt.match(/\d+/g)!.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, h, min, sec));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d ||
    date.getUTCHours() !== h ||
    date.getUTCMinutes() !== min ||
    date.getUTCSeconds() !== sec
  ) {
    return null;
  }
  return { createdAt, id };
}

/** `like` treats % and _ as wildcards; match them literally. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * What `q` can match: part of the charged email, the start of an order
 * number (the first 8 uuid characters, shown uppercased), or a Stripe
 * Checkout Session or PaymentIntent id exactly.
 */
function orderSearch(q: string) {
  const conditions = [
    ilike(orders.email, `%${escapeLike(q)}%`),
    eq(orders.stripeCheckoutSessionId, q),
    eq(orders.stripePaymentIntentId, q),
  ];
  const prefix = q.toLowerCase();
  if (/^[0-9a-f-]{1,36}$/.test(prefix)) {
    conditions.push(sql`${orders.id}::text like ${`${prefix}%`}`);
  }
  return or(...conditions)!;
}

/**
 * One page of orders, newest first. `after` pages towards older orders and
 * `before` towards newer ones; the cursors returned are null at either end.
 */
export async function getAdminOrders({
  q,
  after,
  before,
}: {
  q: string;
  after: OrderCursor | null;
  before: OrderCursor | null;
}) {
  await requireAdmin("/admin/orders");

  const backwards = !after && before !== null;
  const cursor = after ?? before;
  const position = cursor
    ? backwards
      ? sql`(${orders.createdAt}, ${orders.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
      : sql`(${orders.createdAt}, ${orders.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
    : undefined;
  const direction = backwards ? asc : desc;

  const rows = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      cursorAt: sql<string>`${orders.createdAt}::text`,
      email: orders.email,
      totalCents: orders.totalCents,
      customerName: user.name,
      itemCount: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .where(and(q ? orderSearch(q) : undefined, position))
    .orderBy(direction(orders.createdAt), direction(orders.id))
    .limit(ADMIN_ORDERS_PAGE_SIZE + 1);

  const hasMore = rows.length > ADMIN_ORDERS_PAGE_SIZE;
  const page = rows.slice(0, ADMIN_ORDERS_PAGE_SIZE);
  if (backwards) page.reverse();

  const first = page[0];
  const last = page.at(-1);
  const toCursor = (row: (typeof page)[number]) => ({
    createdAt: row.cursorAt,
    id: row.id,
  });
  // Going forwards there are newer orders whenever we started from a
  // cursor, and older ones when the query hit its limit; backwards, the
  // other way round. An empty page past a cursor links back across it.
  const newerCursor = first
    ? (backwards ? hasMore : cursor !== null) && toCursor(first)
    : !backwards && cursor;
  const olderCursor = last
    ? (backwards || hasMore) && toCursor(last)
    : backwards && cursor;
  return {
    orders: page.map(({ cursorAt, ...row }) => {
      void cursorAt;
      return row;
    }),
    newerCursor: newerCursor || null,
    olderCursor: olderCursor || null,
  };
}

/**
 * One order with its customer, lines and the stock changes it caused, or
 * undefined. `id` must already be a valid uuid.
 */
export const getAdminOrder = cache(async (id: string) => {
  await requireAdmin(`/admin/orders/${id}`);

  const [order, adjustments] = await Promise.all([
    db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        user: { columns: { id: true, name: true, email: true } },
        items: true,
      },
    }),
    db.query.stockAdjustments.findMany({
      where: eq(stockAdjustments.orderId, id),
      orderBy: [asc(stockAdjustments.createdAt), asc(stockAdjustments.id)],
      with: { product: { columns: { name: true, slug: true } } },
    }),
  ]);
  return order && { ...order, stockAdjustments: adjustments };
});
