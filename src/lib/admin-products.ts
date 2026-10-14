// Admin reads for products. Every function checks the caller is an admin:
// pages, actions and these queries are each reachable on their own.
import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  categories,
  orderItems,
  productImages,
  products,
  type ProductStatus,
} from "@/db/schema";
import { UUID_PATTERN } from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";

const LIST_PATH = "/admin/products";
export const ADMIN_PRODUCTS_PAGE_SIZE = 25;

export type AdminProductFilters = {
  status?: ProductStatus;
  categoryId?: string;
  q?: string;
};

/**
 * A position in the created_at desc, id desc order. created_at is carried as
 * Postgres text so its microseconds survive the round trip through the URL
 * (a JS Date would cut them to milliseconds and skip or repeat rows).
 */
type Cursor = { createdAt: string; id: string };

const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

export function encodeCursor(cursor: Cursor) {
  return `${cursor.createdAt}~${cursor.id}`;
}

/** Null for anything that isn't a cursor we made. */
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw || raw.length > 80) return null;
  const [createdAt, id, ...rest] = raw.split("~");
  if (rest.length || !createdAt || !id) return null;
  if (!TIMESTAMP_PATTERN.test(createdAt) || !UUID_PATTERN.test(id)) return null;
  return { createdAt, id };
}

/** `%` and `_` typed into the search box match themselves. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function filterWhere({ status, categoryId, q }: AdminProductFilters) {
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(products.status, status));
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (q) {
    const pattern = likePattern(q);
    conditions.push(
      or(
        ilike(products.name, pattern),
        ilike(products.sku, pattern),
        ilike(products.slug, pattern),
      )!,
    );
  }
  return conditions;
}

/**
 * One page of products, newest first. Pass `after` for the page below a
 * cursor, `before` for the page above it. Returns cursors for the
 * neighbouring pages, or null at either end.
 */
export async function listAdminProducts(
  filters: AdminProductFilters,
  { after, before }: { after?: Cursor | null; before?: Cursor | null } = {},
) {
  await requireAdmin(LIST_PATH);

  const conditions = filterWhere(filters);
  const backwards = !after && Boolean(before);
  const cursor = after ?? before;
  if (cursor) {
    const position = sql`(${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
    conditions.push(
      backwards
        ? sql`(${products.createdAt}, ${products.id}) > ${position}`
        : sql`(${products.createdAt}, ${products.id}) < ${position}`,
    );
  }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      priceCents: products.priceCents,
      stockQuantity: products.stockQuantity,
      status: products.status,
      updatedAt: products.updatedAt,
      createdAtText: sql<string>`${products.createdAt}::text`,
      categoryName: categories.name,
      imageCount: sql<number>`(select count(*)::int from ${productImages} where ${productImages.productId} = ${products.id})`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conditions))
    .orderBy(
      ...(backwards
        ? [asc(products.createdAt), asc(products.id)]
        : [desc(products.createdAt), desc(products.id)]),
    )
    .limit(ADMIN_PRODUCTS_PAGE_SIZE + 1);

  const more = rows.length > ADMIN_PRODUCTS_PAGE_SIZE;
  const page = rows.slice(0, ADMIN_PRODUCTS_PAGE_SIZE);
  if (backwards) page.reverse();

  const first = page[0];
  const last = page.at(-1);
  const hasPrevious = backwards ? more : Boolean(after);
  const hasNext = backwards ? true : more;

  return {
    products: page,
    previous:
      hasPrevious && first
        ? encodeCursor({ createdAt: first.createdAtText, id: first.id })
        : null,
    next:
      hasNext && last
        ? encodeCursor({ createdAt: last.createdAtText, id: last.id })
        : null,
  };
}

export async function countAdminProducts(filters: AdminProductFilters) {
  await requireAdmin(LIST_PATH);
  const [row] = await db
    .select({ n: count() })
    .from(products)
    .where(and(...filterWhere(filters)));
  return row?.n ?? 0;
}

/** Categories for the filter and the form's select, in house order. */
export async function getAdminCategoryOptions() {
  await requireAdmin(LIST_PATH);
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name));
}

/** The product with its images in order, or undefined. */
export const getAdminProduct = cache(async (id: string) => {
  await requireAdmin(`${LIST_PATH}/${id}`);
  if (!UUID_PATTERN.test(id)) return undefined;
  return db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      category: { columns: { id: true, name: true, slug: true } },
      images: { orderBy: asc(productImages.position) },
    },
  });
});

/** True when any order line points at the product, so it can't be deleted. */
export async function productHasOrders(id: string) {
  await requireAdmin(`${LIST_PATH}/${id}`);
  if (!UUID_PATTERN.test(id)) return false;
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.productId, id))
    .limit(1);
  return Boolean(row);
}
