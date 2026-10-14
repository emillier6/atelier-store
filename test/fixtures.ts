import { randomUUID } from "node:crypto";
import { inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  orders,
  productImages,
  type ProductStatus,
  products,
  stockAdjustments,
  user,
  type UserRole,
} from "@/db/schema";

/*
 * Throwaway rows for tests that hit the real (dev) database. Everything is
 * marked with a `vitest-<random>` prefix in its slug, sku, email or id, and
 * a Fixtures instance only ever deletes rows it created itself, so a run
 * can't touch real catalogue, customers or orders.
 *
 * Use one per test file:
 *
 *   const fx = new Fixtures();
 *   afterAll(() => fx.cleanup());
 *
 * Products are created as drafts and with no images unless asked, so the
 * storefront (which skips image-less products) never lists them.
 */

export const FIXTURE_PREFIX = "vitest-";

export class Fixtures {
  readonly tag = `${FIXTURE_PREFIX}${randomUUID().slice(0, 8)}`;
  private seq = 0;
  readonly userIds: string[] = [];
  readonly productIds: string[] = [];
  readonly categoryIds: string[] = [];

  /** A unique, prefixed name: `vitest-<run>-<label>-<n>`. */
  name(label: string) {
    this.seq += 1;
    return `${this.tag}-${label}-${this.seq}`;
  }

  async user(role: UserRole = "customer") {
    const id = this.name("user");
    this.userIds.push(id);
    const [row] = await db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, role })
      .returning();
    return row;
  }

  async category() {
    const slug = this.name("cat");
    const [row] = await db
      .insert(categories)
      .values({ slug, name: slug, position: 9999 })
      .returning();
    this.categoryIds.push(row.id);
    return row;
  }

  async product(
    opts: {
      stock?: number;
      status?: ProductStatus;
      sizes?: string[];
      priceCents?: number;
      withImage?: boolean;
    } = {},
  ) {
    const categoryId =
      this.categoryIds[0] ?? (await this.category()).id;
    const slug = this.name("product");
    const [row] = await db
      .insert(products)
      .values({
        categoryId,
        slug,
        name: slug,
        sku: slug.toUpperCase(),
        colour: "Test",
        priceCents: opts.priceCents ?? 1000,
        description: "Vitest fixture.",
        details: [],
        sizes: opts.sizes ?? ["S", "M"],
        stockQuantity: opts.stock ?? 0,
        status: opts.status ?? "draft",
      })
      .returning();
    this.productIds.push(row.id);
    if (opts.withImage) {
      await db.insert(productImages).values({
        productId: row.id,
        url: `https://example.test/${slug}.jpg`,
        alt: slug,
        position: 0,
      });
    }
    return row;
  }

  /**
   * Deletes what this instance created, children first: orders (lines
   * cascade) before users because orders.user_id is restrict; stock history
   * explicitly; products (images and bag lines cascade); categories; users
   * (carts, sessions, accounts cascade). Each step runs even if one fails.
   */
  async cleanup() {
    const errors: unknown[] = [];
    const step = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (error) {
        errors.push(error);
      }
    };
    if (this.userIds.length) {
      await step(() =>
        db.delete(orders).where(inArray(orders.userId, this.userIds)),
      );
    }
    if (this.productIds.length) {
      await step(() =>
        db
          .delete(stockAdjustments)
          .where(inArray(stockAdjustments.productId, this.productIds)),
      );
      await step(() =>
        db.delete(products).where(inArray(products.id, this.productIds)),
      );
    }
    if (this.categoryIds.length) {
      await step(() =>
        db.delete(categories).where(inArray(categories.id, this.categoryIds)),
      );
    }
    if (this.userIds.length) {
      await step(() => db.delete(user).where(inArray(user.id, this.userIds)));
    }
    if (errors.length) throw new AggregateError(errors, "Fixture cleanup failed");
  }
}

/** Counts rows still carrying the fixture prefix, for a final check. */
export async function leftoverFixtureRows() {
  const p = `${FIXTURE_PREFIX}%`;
  const [u, c, pr, o] = await Promise.all([
    db.select({ id: user.id }).from(user).where(or(like(user.id, p), like(user.email, p))),
    db.select({ id: categories.id }).from(categories).where(like(categories.slug, p)),
    db.select({ id: products.id }).from(products).where(like(products.slug, p)),
    db
      .select({ id: orders.id })
      .from(orders)
      .where(
        or(
          like(orders.stripeCheckoutSessionId, p),
          like(orders.stripePaymentIntentId, p),
        ),
      ),
  ]);
  return { users: u.length, categories: c.length, products: pr.length, orders: o.length };
}
