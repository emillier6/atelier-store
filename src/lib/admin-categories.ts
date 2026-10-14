import "server-only";
import { asc, count, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

/*
 * Admin reads for categories. Each one checks the admin itself: pages call
 * them, but so could any future caller, and there is no proxy.ts.
 */

const LIST_PATH = "/admin/categories";

export type AdminCategoryRow = {
  id: string;
  slug: string;
  name: string;
  position: number;
  productCount: number;
  activeCount: number;
};

/** Every category, by position then name, with its product counts. */
export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  await requireAdmin(LIST_PATH);
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      position: categories.position,
      productCount: sql<number>`(count(${products.id}))::int`,
      activeCount: sql<number>`(count(${products.id}) filter (where ${products.status} = 'active'))::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.name));
}

/** One category with its product count, or null. Shared by metadata and page. */
export const getAdminCategory = cache(async (id: string) => {
  await requireAdmin(`${LIST_PATH}/${id}`);
  const [row] = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      position: categories.position,
    })
    .from(categories)
    .where(eq(categories.id, id));
  if (!row) return null;
  return { ...row, productCount: await countCategoryProducts(id) };
});

/** How many products (any status) belong to the category. */
export async function countCategoryProducts(id: string) {
  await requireAdmin(LIST_PATH);
  const [row] = await db
    .select({ n: count() })
    .from(products)
    .where(eq(products.categoryId, id));
  return row?.n ?? 0;
}

/** Slugs of the category's products, whose pages show the category name. */
export async function categoryProductSlugs(id: string) {
  await requireAdmin(LIST_PATH);
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.categoryId, id));
  return rows.map((row) => row.slug);
}

/** One past the highest position, as the default for a new category. */
export async function nextCategoryPosition() {
  await requireAdmin(`${LIST_PATH}/new`);
  const [row] = await db
    .select({ max: sql<number | null>`max(${categories.position})` })
    .from(categories);
  return Math.min((row?.max ?? -1) + 1, 1000);
}
