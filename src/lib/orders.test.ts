import { asc, desc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  cartItems,
  carts,
  orders,
  products,
  stockAdjustments,
} from "@/db/schema";
import { Fixtures } from "../../test/fixtures";

/*
 * fulfillCheckoutSession against the real dev database, on throwaway draft
 * products and users. Stripe is replaced: sessions.retrieve returns the fake
 * session registered for its id, shaped like the expanded Checkout Session
 * the function reads. No real Stripe call is made.
 */

const fakeSessions = vi.hoisted(() => new Map<string, unknown>());
const retrieve = vi.hoisted(() =>
  vi.fn(async (id: string) => {
    const session = fakeSessions.get(id);
    if (!session) throw new Error(`No fake session ${id}`);
    return session;
  }),
);
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve } } }),
}));
// orders.ts imports requireAdmin for its admin reads; not used here.
vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(async () => {
    throw new Error("requireAdmin should not be called");
  }),
}));

const { fulfillCheckoutSession } = await import("@/lib/orders");

const fx = new Fixtures();
afterAll(() => fx.cleanup());

beforeEach(() => {
  retrieve.mockClear();
});

type FakeLine = {
  productId: string | null;
  size: string | null;
  quantity: number;
  unitCents: number;
};

const SHIPPING = {
  name: "Vitest Person",
  address: {
    line1: "1 Test Street",
    line2: "Flat 2",
    city: "Testville",
    state: "TS",
    postal_code: "12345",
    country: "GB",
  },
};

function fakeSession(
  userId: string,
  lines: FakeLine[],
  overrides: Record<string, unknown> = {},
) {
  const id = fx.name("cs");
  const data = lines.map((line) => ({
    description: "Stripe line name",
    quantity: line.quantity,
    amount_total: line.unitCents * line.quantity,
    price: {
      unit_amount: line.unitCents,
      product: {
        deleted: undefined,
        metadata: line.productId
          ? { product_id: line.productId, ...(line.size ? { size: line.size } : {}) }
          : {},
      },
    },
  }));
  const session = {
    id,
    payment_status: "paid",
    client_reference_id: userId,
    payment_intent: fx.name("pi"),
    customer_details: { email: "buyer@example.test" },
    customer_email: null,
    amount_total: data.reduce((sum, l) => sum + l.amount_total, 0),
    currency: "usd",
    line_items: { data },
    collected_information: { shipping_details: SHIPPING },
    ...overrides,
  };
  fakeSessions.set(id, session);
  return session;
}

async function bag(userId: string, rows: { productId: string; size: string | null; quantity: number }[]) {
  const [cart] = await db.insert(carts).values({ userId }).returning();
  if (rows.length) {
    await db.insert(cartItems).values(rows.map((r) => ({ ...r, cartId: cart.id })));
  }
}

async function bagLines(userId: string) {
  return db
    .select({ productId: cartItems.productId, size: cartItems.size, quantity: cartItems.quantity })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .where(eq(carts.userId, userId));
}

async function ordersFor(sessionId: string) {
  return db.query.orders.findMany({
    where: eq(orders.stripeCheckoutSessionId, sessionId),
    with: { items: true },
  });
}

async function stockOf(productId: string) {
  const [row] = await db
    .select({ stock: products.stockQuantity })
    .from(products)
    .where(eq(products.id, productId));
  return row.stock;
}

async function history(productId: string) {
  return db
    .select()
    .from(stockAdjustments)
    .where(eq(stockAdjustments.productId, productId))
    .orderBy(
      asc(stockAdjustments.createdAt),
      // One fulfilment's rows share now() (one transaction); stock only
      // falls within it, so higher stock_after came first.
      desc(stockAdjustments.stockAfter),
    );
}

describe("fulfillCheckoutSession", () => {
  it("writes the order, lines, shipping, stock, history and trims the bag", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5, priceCents: 1500, withImage: true });
    const keep = await fx.product({ stock: 5 });
    await bag(u.id, [
      { productId: p.id, size: "S", quantity: 2 },
      // Added while on Stripe's page, or simply not bought: must stay.
      { productId: p.id, size: "M", quantity: 1 },
      { productId: keep.id, size: "S", quantity: 1 },
    ]);
    const session = fakeSession(u.id, [
      { productId: p.id, size: "S", quantity: 2, unitCents: 1500 },
    ]);

    const paths = await fulfillCheckoutSession(session.id);

    expect(retrieve).toHaveBeenCalledWith(session.id, {
      expand: ["line_items.data.price.product"],
    });
    const [order, ...extra] = await ordersFor(session.id);
    expect(extra).toHaveLength(0);
    expect(order).toMatchObject({
      userId: u.id,
      stripePaymentIntentId: session.payment_intent,
      email: "buyer@example.test",
      totalCents: 3000,
      currency: "usd",
      shippingName: "Vitest Person",
      shippingLine1: "1 Test Street",
      shippingLine2: "Flat 2",
      shippingCity: "Testville",
      shippingState: "TS",
      shippingPostalCode: "12345",
      shippingCountry: "GB",
      fulfillmentStatus: "unfulfilled",
      refundedCents: 0,
    });
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productId: p.id,
      productSlug: p.slug,
      name: p.name,
      sku: p.sku,
      colour: p.colour,
      size: "S",
      imageUrl: `https://example.test/${p.slug}.jpg`,
      unitPriceCents: 1500,
      quantity: 2,
      lineTotalCents: 3000,
    });

    expect(await stockOf(p.id)).toBe(3);
    expect(await stockOf(keep.id)).toBe(5);
    const rows = await history(p.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      delta: -2,
      stockAfter: 3,
      reason: "sale",
      orderId: order.id,
      userId: null,
    });

    const left = await bagLines(u.id);
    expect(left).toHaveLength(2);
    expect(left).toEqual(
      expect.arrayContaining([
        { productId: p.id, size: "M", quantity: 1 },
        { productId: keep.id, size: "S", quantity: 1 },
      ]),
    );

    const [category] = await db.query.categories.findMany({
      where: (c, { eq: e }) => e(c.id, p.categoryId),
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/new-arrivals",
        `/products/${p.slug}`,
        `/collections/${category.slug}`,
      ]),
    );
  });

  it("is idempotent: a second delivery writes nothing new", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5 });
    await bag(u.id, []);
    const session = fakeSession(u.id, [
      { productId: p.id, size: "S", quantity: 1, unitCents: 1000 },
    ]);

    expect((await fulfillCheckoutSession(session.id)).length).toBeGreaterThan(0);
    expect(await fulfillCheckoutSession(session.id)).toEqual([]);

    const found = await ordersFor(session.id);
    expect(found).toHaveLength(1);
    expect(found[0].items).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(4);
    expect(await history(p.id)).toHaveLength(1);
    // The repeat stops at the existing-order check, before calling Stripe.
    expect(retrieve).toHaveBeenCalledTimes(1);
  });

  it("concurrent deliveries of one session write one order and one decrement", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5 });
    const session = fakeSession(u.id, [
      { productId: p.id, size: "S", quantity: 2, unitCents: 1000 },
    ]);

    const results = await Promise.all([
      fulfillCheckoutSession(session.id),
      fulfillCheckoutSession(session.id),
      fulfillCheckoutSession(session.id),
    ]);

    expect(results.filter((r) => r.length > 0)).toHaveLength(1);
    const found = await ordersFor(session.id);
    expect(found).toHaveLength(1);
    expect(found[0].items).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(3);
    expect(await history(p.id)).toHaveLength(1);
  });

  it("chains two sizes of one product and records the shortfall as oversell", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 3 });
    const session = fakeSession(u.id, [
      { productId: p.id, size: "S", quantity: 2, unitCents: 1000 },
      { productId: p.id, size: "M", quantity: 2, unitCents: 1000 },
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let warnings: unknown[][];
    try {
      await fulfillCheckoutSession(session.id);
    } finally {
      warnings = [...warn.mock.calls];
      warn.mockRestore();
    }

    expect(await stockOf(p.id)).toBe(0);
    const rows = await history(p.id);
    expect(rows.map((r) => [r.reason, r.delta, r.stockAfter])).toEqual([
      ["sale", -2, 1],
      ["oversell", -1, 0],
    ]);
    // The customer paid for 4: the order says so, whatever the stock was.
    const [order] = await ordersFor(session.id);
    expect(order.totalCents).toBe(4000);
    expect(order.items.map((i) => i.quantity)).toEqual([2, 2]);
    expect(warnings).toEqual([
      [
        "Oversold at fulfilment",
        expect.objectContaining({ productId: p.id, size: "M", requested: 2, available: 1 }),
      ],
    ]);
  });

  it("records an oversell with delta 0 when nothing is left", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 0 });
    const session = fakeSession(u.id, [
      { productId: p.id, size: null, quantity: 1, unitCents: 1000 },
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await fulfillCheckoutSession(session.id);
    } finally {
      warn.mockRestore();
    }
    expect(await stockOf(p.id)).toBe(0);
    const rows = await history(p.id);
    expect(rows.map((r) => [r.reason, r.delta, r.stockAfter])).toEqual([
      ["oversell", 0, 0],
    ]);
    expect(await ordersFor(session.id)).toHaveLength(1);
  });

  it("removes a one-size (null) bag line that was bought", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5, sizes: [] });
    const q = await fx.product({ stock: 5, sizes: [] });
    await bag(u.id, [
      { productId: p.id, size: null, quantity: 1 },
      { productId: q.id, size: null, quantity: 1 },
    ]);
    const session = fakeSession(u.id, [
      { productId: p.id, size: null, quantity: 1, unitCents: 1000 },
    ]);
    await fulfillCheckoutSession(session.id);
    expect(await bagLines(u.id)).toEqual([{ productId: q.id, size: null, quantity: 1 }]);
  });

  it("writes nothing for an unpaid session", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5 });
    await bag(u.id, [{ productId: p.id, size: "S", quantity: 1 }]);
    const session = fakeSession(
      u.id,
      [{ productId: p.id, size: "S", quantity: 1, unitCents: 1000 }],
      { payment_status: "unpaid" },
    );

    expect(await fulfillCheckoutSession(session.id)).toEqual([]);
    expect(await ordersFor(session.id)).toHaveLength(0);
    expect(await stockOf(p.id)).toBe(5);
    expect(await history(p.id)).toHaveLength(0);
    expect(await bagLines(u.id)).toHaveLength(1);
  });

  it("skips a session with no user (e.g. `stripe trigger`)", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5 });
    const session = fakeSession(
      u.id,
      [{ productId: p.id, size: "S", quantity: 1, unitCents: 1000 }],
      { client_reference_id: null },
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      expect(await fulfillCheckoutSession(session.id)).toEqual([]);
    } finally {
      info.mockRestore();
    }
    expect(await ordersFor(session.id)).toHaveLength(0);
    expect(await stockOf(p.id)).toBe(5);
  });

  it("keeps a line whose product is gone, without touching stock", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5 });
    const session = fakeSession(u.id, [
      { productId: p.id, size: "S", quantity: 1, unitCents: 1000 },
      { productId: null, size: null, quantity: 1, unitCents: 500 },
    ]);
    await fulfillCheckoutSession(session.id);
    const [order] = await ordersFor(session.id);
    expect(order.totalCents).toBe(1500);
    const orphan = order.items.find((i) => i.productId === null);
    expect(orphan).toMatchObject({ name: "Stripe line name", productSlug: "", lineTotalCents: 500 });
    expect(await stockOf(p.id)).toBe(4);
  });
});
