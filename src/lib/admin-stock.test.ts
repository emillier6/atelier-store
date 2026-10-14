import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { products, stockAdjustments } from "@/db/schema";
import { Fixtures } from "../../test/fixtures";

/*
 * Admin stock writes against the real dev database, on throwaway draft
 * products. requireAdmin is replaced by a fixture admin; its own checks are
 * covered in session-admin.test.ts.
 */

const admin = vi.hoisted(() => ({ current: null as null | { id: string } }));
const requireAdmin = vi.hoisted(() =>
  vi.fn(async () => {
    if (!admin.current) throw new Error("fixture admin not ready");
    return admin.current;
  }),
);
vi.mock("@/lib/session", () => ({ requireAdmin }));

const { adjustStock, setStock, getStockPanel } = await import(
  "@/lib/admin-stock"
);

const fx = new Fixtures();
afterAll(() => fx.cleanup());

beforeAll(async () => {
  admin.current = await fx.user("admin");
});

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
    .orderBy(asc(stockAdjustments.createdAt), asc(stockAdjustments.stockAfter));
}

describe("setStock", () => {
  it("applies when expected matches and records one correction", async () => {
    const p = await fx.product({ stock: 5 });
    const result = await setStock({
      productId: p.id,
      expected: 5,
      quantity: 2,
      reason: "correction",
    });
    expect(result).toEqual({
      ok: true,
      stock: 2,
      productSlug: p.slug,
      categorySlug: expect.stringMatching(/^vitest-/),
    });
    expect(await stockOf(p.id)).toBe(2);
    const rows = await history(p.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      delta: -3,
      stockAfter: 2,
      reason: "correction",
      userId: admin.current!.id,
      orderId: null,
    });
    expect(requireAdmin).toHaveBeenCalledWith(`/admin/products/${p.id}`);
  });

  it("writes nothing when the count moved since the admin looked", async () => {
    const p = await fx.product({ stock: 5 });
    const result = await setStock({
      productId: p.id,
      expected: 4,
      quantity: 10,
      reason: "restock",
    });
    expect(result).toEqual({ ok: false, current: 5 });
    expect(await stockOf(p.id)).toBe(5);
    expect(await history(p.id)).toHaveLength(0);
  });

  it("writes nothing when quantity equals expected", async () => {
    const p = await fx.product({ stock: 5 });
    const result = await setStock({
      productId: p.id,
      expected: 5,
      quantity: 5,
      reason: "correction",
    });
    expect(result).toEqual({ ok: false, current: 5 });
    expect(await history(p.id)).toHaveLength(0);
  });

  it("reports current: null for an unknown product", async () => {
    const result = await setStock({
      productId: "00000000-0000-4000-8000-000000000000",
      expected: 0,
      quantity: 1,
      reason: "restock",
    });
    expect(result).toEqual({ ok: false, current: null });
  });

  it("refuses a negative quantity (the CHECK fails the statement)", async () => {
    const p = await fx.product({ stock: 5 });
    await expect(
      setStock({ productId: p.id, expected: 5, quantity: -1, reason: "correction" }),
    ).rejects.toThrow();
    expect(await stockOf(p.id)).toBe(5);
    expect(await history(p.id)).toHaveLength(0);
  });

  it("of two racing sets from the same view, only one wins", async () => {
    const p = await fx.product({ stock: 5 });
    const results = await Promise.all([
      setStock({ productId: p.id, expected: 5, quantity: 8, reason: "restock" }),
      setStock({ productId: p.id, expected: 5, quantity: 1, reason: "correction" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const rows = await history(p.id);
    expect(rows).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(rows[0].stockAfter);
  });
});

describe("adjustStock", () => {
  it("adds and removes, recording delta and stock_after", async () => {
    const p = await fx.product({ stock: 2 });
    expect(await adjustStock({ productId: p.id, delta: 5, reason: "restock" })).toMatchObject({
      ok: true,
      stock: 7,
    });
    expect(
      await adjustStock({ productId: p.id, delta: -3, reason: "correction" }),
    ).toMatchObject({ ok: true, stock: 4 });
    const rows = await history(p.id);
    expect(rows.map((r) => [r.delta, r.stockAfter, r.reason])).toEqual([
      [5, 7, "restock"],
      [-3, 4, "correction"],
    ]);
  });

  it("never goes below zero: fails instead of clamping", async () => {
    const p = await fx.product({ stock: 2 });
    expect(
      await adjustStock({ productId: p.id, delta: -3, reason: "correction" }),
    ).toEqual({ ok: false, current: 2 });
    expect(await stockOf(p.id)).toBe(2);
    expect(
      await adjustStock({ productId: p.id, delta: -2, reason: "correction" }),
    ).toMatchObject({ ok: true, stock: 0 });
    expect(await history(p.id)).toHaveLength(1);
  });

  it("refuses a zero delta and going past MAX_STOCK", async () => {
    const p = await fx.product({ stock: 99_999 });
    expect(await adjustStock({ productId: p.id, delta: 0, reason: "restock" })).toEqual({
      ok: false,
      current: 99_999,
    });
    expect(await adjustStock({ productId: p.id, delta: 2, reason: "restock" })).toEqual({
      ok: false,
      current: 99_999,
    });
    expect(await adjustStock({ productId: p.id, delta: 1, reason: "restock" })).toMatchObject({
      ok: true,
      stock: 100_000,
    });
    expect(await history(p.id)).toHaveLength(1);
  });

  it("concurrent adjusts don't lose updates", async () => {
    const p = await fx.product({ stock: 0 });
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        adjustStock({ productId: p.id, delta: 1, reason: "restock" }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await stockOf(p.id)).toBe(8);
    const rows = await history(p.id);
    expect(rows).toHaveLength(8);
    // Each write saw the one before it: stock_after runs 1..8 exactly once.
    expect(rows.map((r) => r.stockAfter).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("concurrent removals never go negative and history matches", async () => {
    const p = await fx.product({ stock: 3 });
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        adjustStock({ productId: p.id, delta: -1, reason: "correction" }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(await stockOf(p.id)).toBe(0);
    const rows = await history(p.id);
    expect(rows).toHaveLength(3);
    expect(rows.reduce((sum, r) => sum + r.delta, 0)).toBe(-3);
    expect(rows.map((r) => r.stockAfter).sort()).toEqual([0, 1, 2]);
  });
});

describe("getStockPanel", () => {
  it("returns stock and history with the admin who made each change", async () => {
    const p = await fx.product({ stock: 1 });
    await adjustStock({ productId: p.id, delta: 4, reason: "restock" });
    const panel = await getStockPanel(p.id);
    expect(panel?.stock).toBe(5);
    expect(panel?.history).toHaveLength(1);
    expect(panel?.history[0]).toMatchObject({
      delta: 4,
      stockAfter: 5,
      reason: "restock",
      admin: { email: `${admin.current!.id}@example.test` },
    });
  });
});
