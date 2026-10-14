import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { cartItems, carts, products } from "@/db/schema";
import { addItem, getBag, removeItem, setQuantity } from "@/lib/cart";
import { Fixtures } from "../../test/fixtures";

/*
 * The bag's SQL against the real dev database, on throwaway fixtures. Active
 * fixture products have no images, so the storefront (which skips image-less
 * products) never lists them.
 */

const fx = new Fixtures();
afterAll(() => fx.cleanup());

async function lines(userId: string) {
  const rows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      size: cartItems.size,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .where(eq(carts.userId, userId));
  return rows;
}

async function qty(userId: string, productId: string, size: string | null) {
  const rows = await lines(userId);
  return (
    rows.find((r) => r.productId === productId && r.size === size)?.quantity ??
    0
  );
}

describe("addItem", () => {
  it("caps a line at stock minus the product's other sizes in the bag", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 3, status: "active", sizes: ["S", "M", "L"] });

    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 2 })).toBe(true);
    expect(await qty(u.id, p.id, "S")).toBe(2);

    // Only one unit left across sizes: asking for 5 M gives 1.
    expect(await addItem(u.id, { productId: p.id, size: "M", quantity: 5 })).toBe(true);
    expect(await qty(u.id, p.id, "M")).toBe(1);

    // Bag now holds all 3; every further add is refused and changes nothing.
    expect(await addItem(u.id, { productId: p.id, size: "M", quantity: 1 })).toBe(false);
    expect(await addItem(u.id, { productId: p.id, size: "L", quantity: 1 })).toBe(false);
    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 1 })).toBe(false);
    expect(await qty(u.id, p.id, "S")).toBe(2);
    expect(await qty(u.id, p.id, "M")).toBe(1);
    expect(await qty(u.id, p.id, "L")).toBe(0);
  });

  it("merges repeated adds of the same size, up to the cap", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 4, status: "active" });

    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 1 })).toBe(true);
    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 2 })).toBe(true);
    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 5 })).toBe(true);
    const rows = await lines(u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(4);
  });

  it("merges one-size (null size) lines too", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5, status: "active", sizes: [] });

    await addItem(u.id, { productId: p.id, size: null, quantity: 1 });
    await addItem(u.id, { productId: p.id, size: null, quantity: 2 });
    const rows = await lines(u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ size: null, quantity: 3 });
  });

  it("never goes past MAX_QUANTITY (10) even with plenty of stock", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 50, status: "active" });

    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 15 })).toBe(true);
    expect(await qty(u.id, p.id, "S")).toBe(10);
    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 1 })).toBe(false);
    expect(await qty(u.id, p.id, "S")).toBe(10);
  });

  it("refuses a sold-out product", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 0, status: "active" });
    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 1 })).toBe(false);
    expect(await lines(u.id)).toHaveLength(0);
  });

  it.each(["draft", "archived"] as const)("refuses a %s product", async (status) => {
    const u = await fx.user();
    const p = await fx.product({ stock: 10, status });
    expect(await addItem(u.id, { productId: p.id, size: "S", quantity: 1 })).toBe(false);
    expect(await lines(u.id)).toHaveLength(0);
  });

  it("refuses an unknown product id", async () => {
    const u = await fx.user();
    expect(
      await addItem(u.id, {
        productId: "00000000-0000-4000-8000-000000000000",
        size: "S",
        quantity: 1,
      }),
    ).toBe(false);
  });

  it("keeps two concurrent adds within stock", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 3, status: "active" });
    await Promise.all([
      addItem(u.id, { productId: p.id, size: "S", quantity: 2 }),
      addItem(u.id, { productId: p.id, size: "S", quantity: 2 }),
    ]);
    expect(await qty(u.id, p.id, "S")).toBeLessThanOrEqual(3);
  });
});

describe("setQuantity", () => {
  it("refuses raising past stock across sizes, allows lowering", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 3, status: "active" });
    await addItem(u.id, { productId: p.id, size: "S", quantity: 2 });
    await addItem(u.id, { productId: p.id, size: "M", quantity: 1 });
    const rows = await lines(u.id);
    const s = rows.find((r) => r.size === "S")!;
    const m = rows.find((r) => r.size === "M")!;

    // M can't go to 2 while S holds 2 of the 3.
    expect(await setQuantity(u.id, m.id, 2)).toBe(false);
    expect(await qty(u.id, p.id, "M")).toBe(1);

    // Lowering S frees a unit, which M can then take.
    expect(await setQuantity(u.id, s.id, 1)).toBe(true);
    expect(await setQuantity(u.id, m.id, 2)).toBe(true);
    expect(await setQuantity(u.id, s.id, 2)).toBe(false);
    expect(await qty(u.id, p.id, "S")).toBe(1);
    expect(await qty(u.id, p.id, "M")).toBe(2);
  });

  it("allows lowering a bag that is already over stock", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 5, status: "active" });
    await addItem(u.id, { productId: p.id, size: "S", quantity: 5 });
    const [line] = await lines(u.id);
    // Stock falls under what the bag holds (a sale elsewhere).
    await db.update(products).set({ stockQuantity: 1 }).where(eq(products.id, p.id));

    expect(await setQuantity(u.id, line.id, 4)).toBe(true);
    expect(await setQuantity(u.id, line.id, 5)).toBe(false);
    expect(await qty(u.id, p.id, "S")).toBe(4);
  });

  it("refuses raising past MAX_QUANTITY", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 50, status: "active" });
    await addItem(u.id, { productId: p.id, size: "S", quantity: 1 });
    const [line] = await lines(u.id);
    expect(await setQuantity(u.id, line.id, 10)).toBe(true);
    expect(await setQuantity(u.id, line.id, 11)).toBe(false);
  });

  it("refuses raising an inactive product but allows lowering it", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 10, status: "active" });
    await addItem(u.id, { productId: p.id, size: "S", quantity: 2 });
    const [line] = await lines(u.id);
    await db.update(products).set({ status: "archived" }).where(eq(products.id, p.id));

    expect(await setQuantity(u.id, line.id, 3)).toBe(false);
    expect(await setQuantity(u.id, line.id, 1)).toBe(true);
    expect(await qty(u.id, p.id, "S")).toBe(1);
  });

  it("can't set a quantity below 1", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 10, status: "active" });
    await addItem(u.id, { productId: p.id, size: "S", quantity: 2 });
    const [line] = await lines(u.id);
    // The CHECK (quantity > 0) rejects it; the action layer validates first.
    await expect(setQuantity(u.id, line.id, 0)).rejects.toThrow();
    expect(await qty(u.id, p.id, "S")).toBe(2);
  });
});

describe("line writes are scoped to the caller's cart", () => {
  let owner: { id: string };
  let other: { id: string };
  let lineId: string;
  let productId: string;

  beforeAll(async () => {
    owner = await fx.user();
    other = await fx.user();
    const p = await fx.product({ stock: 10, status: "active" });
    productId = p.id;
    await addItem(owner.id, { productId, size: "S", quantity: 2 });
    // The other user has a cart of their own too.
    await addItem(other.id, { productId, size: "M", quantity: 1 });
    lineId = (await lines(owner.id))[0].id;
  });

  it("setQuantity with someone else's line id changes nothing", async () => {
    expect(await setQuantity(other.id, lineId, 1)).toBe(false);
    expect(await setQuantity(other.id, lineId, 5)).toBe(false);
    expect(await qty(owner.id, productId, "S")).toBe(2);
  });

  it("removeItem with someone else's line id changes nothing", async () => {
    await removeItem(other.id, lineId);
    expect(await qty(owner.id, productId, "S")).toBe(2);
    expect(await qty(other.id, productId, "M")).toBe(1);
  });

  it("a user with no cart can't touch a line", async () => {
    const stranger = await fx.user();
    expect(await setQuantity(stranger.id, lineId, 1)).toBe(false);
    await removeItem(stranger.id, lineId);
    expect(await qty(owner.id, productId, "S")).toBe(2);
  });

  it("the owner can remove their own line", async () => {
    await removeItem(owner.id, lineId);
    const [row] = await db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(and(eq(cartItems.id, lineId)));
    expect(row).toBeUndefined();
  });
});

describe("getBag", () => {
  it("flags every line of a product whose sizes together exceed stock", async () => {
    const u = await fx.user();
    const p = await fx.product({ stock: 3, status: "active" });
    await addItem(u.id, { productId: p.id, size: "S", quantity: 2 });
    await addItem(u.id, { productId: p.id, size: "M", quantity: 1 });
    let bag = await getBag(u.id);
    expect(bag.lines.every((l) => !l.unavailable)).toBe(true);
    expect(bag.subtotalCents).toBe(3 * p.priceCents);

    await db.update(products).set({ stockQuantity: 2 }).where(eq(products.id, p.id));
    bag = await getBag(u.id);
    expect(bag.lines.every((l) => l.unavailable)).toBe(true);
  });
});
