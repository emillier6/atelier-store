import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { Fixtures } from "../../test/fixtures";

/*
 * Refund bookkeeping against the real dev database, on fixture orders with
 * made-up `vitest-` PaymentIntent ids. Stripe and requireAdmin are replaced;
 * no real refund is ever made.
 */

const stripe = vi.hoisted(() => ({
  refunds: { create: vi.fn() },
  charges: { retrieve: vi.fn() },
  paymentIntents: { retrieve: vi.fn() },
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => stripe }));
const requireAdmin = vi.hoisted(() => vi.fn(async () => ({ id: "admin" })));
vi.mock("@/lib/session", () => ({ requireAdmin }));

const { recordRefundedAmount, recordChargeRefunded, refundOrder, refundPaths } =
  await import("@/lib/refunds");

const fx = new Fixtures();
afterAll(() => fx.cleanup());

let userId: string;
beforeAll(async () => {
  userId = (await fx.user()).id;
});

beforeEach(() => {
  stripe.refunds.create.mockReset();
  stripe.charges.retrieve.mockReset();
  stripe.paymentIntents.retrieve.mockReset();
  requireAdmin.mockClear();
});

async function makeOrder(
  opts: { totalCents?: number; refundedCents?: number; paymentIntent?: string | null } = {},
) {
  const [row] = await db
    .insert(orders)
    .values({
      userId,
      stripeCheckoutSessionId: fx.name("cs"),
      stripePaymentIntentId:
        opts.paymentIntent === undefined ? fx.name("pi") : opts.paymentIntent,
      email: "buyer@example.test",
      totalCents: opts.totalCents ?? 5000,
      refundedCents: opts.refundedCents ?? 0,
    })
    .returning();
  return row;
}

async function reload(orderId: string) {
  const [row] = await db
    .select({ refundedCents: orders.refundedCents, refundedAt: orders.refundedAt })
    .from(orders)
    .where(eq(orders.id, orderId));
  return row;
}

describe("recordRefundedAmount", () => {
  it("only ever raises the total, capped at the order total", async () => {
    const order = await makeOrder({ totalCents: 5000 });
    const pi = order.stripePaymentIntentId!;

    expect(await recordRefundedAmount(pi, 1000)).toEqual([order.id]);
    const first = await reload(order.id);
    expect(first.refundedCents).toBe(1000);
    expect(first.refundedAt).toBeInstanceOf(Date);

    // A repeated or older (lower) event changes neither field.
    await recordRefundedAmount(pi, 1000);
    await recordRefundedAmount(pi, 500);
    await recordRefundedAmount(pi, 0);
    await recordRefundedAmount(pi, -200);
    const same = await reload(order.id);
    expect(same.refundedCents).toBe(1000);
    expect(same.refundedAt).toEqual(first.refundedAt);

    // A higher total moves both.
    await recordRefundedAmount(pi, 3000);
    const raised = await reload(order.id);
    expect(raised.refundedCents).toBe(3000);
    expect(raised.refundedAt!.getTime()).toBeGreaterThan(first.refundedAt!.getTime());

    // Never past what was charged (the CHECK would refuse it otherwise).
    await recordRefundedAmount(pi, 999_999);
    const capped = await reload(order.id);
    expect(capped.refundedCents).toBe(5000);

    // At the cap, a repeat doesn't move refunded_at.
    await recordRefundedAmount(pi, 999_999);
    expect((await reload(order.id)).refundedAt).toEqual(capped.refundedAt);
  });

  it("truncates a fractional amount instead of failing", async () => {
    const order = await makeOrder();
    await recordRefundedAmount(order.stripePaymentIntentId!, 100.9);
    expect((await reload(order.id)).refundedCents).toBe(100);
  });

  it("leaves refunded_at null when nothing was refunded", async () => {
    const order = await makeOrder();
    await recordRefundedAmount(order.stripePaymentIntentId!, 0);
    expect(await reload(order.id)).toEqual({ refundedCents: 0, refundedAt: null });
  });

  it("is a no-op for an unknown PaymentIntent", async () => {
    const order = await makeOrder();
    expect(await recordRefundedAmount(fx.name("pi-unknown"), 1000)).toEqual([]);
    expect((await reload(order.id)).refundedCents).toBe(0);
  });

  it("concurrent events settle on the highest total", async () => {
    const order = await makeOrder({ totalCents: 5000 });
    const pi = order.stripePaymentIntentId!;
    await Promise.all(
      [1000, 4000, 2000, 3000].map((amount) => recordRefundedAmount(pi, amount)),
    );
    expect((await reload(order.id)).refundedCents).toBe(4000);
  });
});

describe("recordChargeRefunded", () => {
  const charge = (payment_intent: unknown, amount_refunded: number) =>
    ({ id: "ch_vitest", payment_intent, amount_refunded }) as unknown as Stripe.Charge;

  it("records by PaymentIntent id (string or expanded) and returns refund paths", async () => {
    const order = await makeOrder();
    const pi = order.stripePaymentIntentId!;

    expect(await recordChargeRefunded(charge(pi, 700))).toEqual(refundPaths(order.id));
    expect((await reload(order.id)).refundedCents).toBe(700);

    await recordChargeRefunded(charge({ id: pi }, 900));
    expect((await reload(order.id)).refundedCents).toBe(900);
    expect(refundPaths(order.id)).toEqual([
      "/admin/orders",
      `/admin/orders/${order.id}`,
      "/account",
    ]);
  });

  it("ignores a charge with no PaymentIntent or for no known order", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      expect(await recordChargeRefunded(charge(null, 100))).toEqual([]);
      expect(await recordChargeRefunded(charge(fx.name("pi-unknown"), 100))).toEqual([]);
    } finally {
      info.mockRestore();
    }
  });
});

describe("refundOrder validation (Stripe mocked)", () => {
  it("checks the admin itself", async () => {
    const order = await makeOrder({ paymentIntent: null });
    await refundOrder({ orderId: order.id, amountCents: 100, seenRefundedCents: 0 });
    expect(requireAdmin).toHaveBeenCalledWith(`/admin/orders/${order.id}`);
  });

  it("refuses an unknown order", async () => {
    const result = await refundOrder({
      orderId: "00000000-0000-4000-8000-000000000000",
      amountCents: 100,
      seenRefundedCents: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("refuses an order with no PaymentIntent", async () => {
    const order = await makeOrder({ paymentIntent: null });
    const result = await refundOrder({ orderId: order.id, amountCents: 100, seenRefundedCents: 0 });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/no Stripe payment/) });
  });

  it("refuses a fully refunded order", async () => {
    const order = await makeOrder({ totalCents: 5000, refundedCents: 5000 });
    const result = await refundOrder({ orderId: order.id, amountCents: 1, seenRefundedCents: 5000 });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/fully refunded/) });
  });

  it("refuses when a refund was recorded since the admin looked", async () => {
    const order = await makeOrder({ totalCents: 5000, refundedCents: 1000 });
    const result = await refundOrder({ orderId: order.id, amountCents: 100, seenRefundedCents: 0 });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/since you loaded/) });
  });

  it.each([
    ["zero", 0],
    ["negative", -100],
    ["fractional", 10.5],
    ["NaN", Number.NaN],
    ["more than remains", 4001],
  ])("refuses an amount that is %s", async (_, amountCents) => {
    const order = await makeOrder({ totalCents: 5000, refundedCents: 1000 });
    const result = await refundOrder({ orderId: order.id, amountCents, seenRefundedCents: 1000 });
    expect(result).toMatchObject({ ok: false, field: "amount" });
  });

  afterAll(() => {
    // None of the refused requests above may reach Stripe.
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
});

describe("refundOrder with a mocked successful refund", () => {
  it("sends a deterministic idempotency key and records the charge total", async () => {
    const order = await makeOrder({ totalCents: 5000, refundedCents: 1000 });
    const pi = order.stripePaymentIntentId!;
    stripe.refunds.create.mockResolvedValue({
      status: "succeeded",
      charge: { amount_refunded: 3000 },
    });

    const result = await refundOrder({ orderId: order.id, amountCents: 2000, seenRefundedCents: 1000 });

    expect(result).toEqual({ ok: true, amountCents: 2000, refundedCents: 3000, pending: false });
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
    const [params, options] = stripe.refunds.create.mock.calls[0];
    expect(params).toMatchObject({ payment_intent: pi, amount: 2000 });
    expect(options).toEqual({ idempotencyKey: `refund:${order.id}:1000:2000` });
    expect((await reload(order.id)).refundedCents).toBe(3000);
  });

  it("reports a Stripe failure without recording anything", async () => {
    const order = await makeOrder({ totalCents: 5000 });
    stripe.refunds.create.mockRejectedValue(
      Object.assign(new Error("boom"), { type: "StripeConnectionError" }),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await refundOrder({ orderId: order.id, amountCents: 100, seenRefundedCents: 0 });
      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/can't refund twice/) });
    } finally {
      error.mockRestore();
    }
    expect((await reload(order.id)).refundedCents).toBe(0);
  });
});
