// Catalog reads for Server Components. Returns the storefront `Product` shape.
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { products } from "@/db/schema";
import type { Product } from "@/lib/catalog";

const withRelations = { category: true, stock: true } as const;

// Written with its own alias: inside `db.query.*`, interpolated columns of
// other tables get rewritten to the root table's alias ("products").
function categoryIdBySlug(slug: string) {
  return sql`(select c.id from categories c where c.slug = ${slug})`;
}

type ProductRow = NonNullable<
  Awaited<
    ReturnType<typeof db.query.products.findFirst<{ with: typeof withRelations }>>
  >
>;

function toProduct(row: ProductRow): Product {
  const [image, ...gallery] = row.images;
  return {
    slug: row.slug,
    name: row.name,
    category: { slug: row.category.slug, name: row.category.name },
    price: row.priceCents,
    image,
    gallery: gallery.length > 0 ? gallery : undefined,
    badge: row.badge ?? undefined,
    sku: row.sku,
    color: row.color,
    description: row.description,
    details: row.details,
    sizes: row.sizes.length > 0 ? row.sizes : undefined,
    stock: row.stock?.quantity ?? 0,
  };
}

export const getProduct = cache(async (slug: string) => {
  const row = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: withRelations,
  });
  return row && toProduct(row);
});

export async function getProductSlugs() {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.active, true));
  return rows.map((row) => row.slug);
}

export async function getNewArrivals(limit = 8) {
  const rows = await db.query.products.findMany({
    where: eq(products.active, true),
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return rows.map(toProduct);
}

export async function getProductsByCategory(slug: string, limit?: number) {
  const rows = await db.query.products.findMany({
    where: and(
      eq(products.active, true),
      eq(products.categoryId, categoryIdBySlug(slug)),
    ),
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return rows.map(toProduct);
}

/** Same-category products first, then the rest of the catalog. */
export async function getRelatedProducts(product: Product, limit = 4) {
  const rows = await db.query.products.findMany({
    where: and(eq(products.active, true), ne(products.slug, product.slug)),
    with: withRelations,
    orderBy: [
      desc(
        sql`${products.categoryId} = ${categoryIdBySlug(product.category.slug)}`,
      ),
      desc(products.createdAt),
    ],
    limit,
  });
  return rows.map(toProduct);
}
