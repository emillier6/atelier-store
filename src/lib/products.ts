// Catalog reads for Server Components. Returns the storefront `Product` shape.
import { asc, desc, eq, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { categories, productImages, products } from "@/db/schema";
import type { Product } from "@/lib/catalog";

const withRelations = {
  category: true,
  images: { orderBy: asc(productImages.position) },
} as const;

// Written with its own alias: inside `db.query.*`, interpolated columns of
// other tables get rewritten to the root table's alias ("products").
function categoryIdBySlug(slug: string) {
  return sql`(select c.id from categories c where c.slug = ${slug})`;
}

type ProductRow = NonNullable<
  Awaited<
    ReturnType<
      typeof db.query.products.findFirst<{ with: typeof withRelations }>
    >
  >
>;

/** Null when the product has no images: every card and page needs one. */
function toProduct(row: ProductRow): Product | null {
  const [image, ...gallery] = row.images.map((i) => ({
    src: i.url,
    alt: i.alt,
  }));
  if (!image) return null;
  return {
    slug: row.slug,
    name: row.name,
    category: { slug: row.category.slug, name: row.category.name },
    price: row.priceCents,
    image,
    gallery: gallery.length > 0 ? gallery : undefined,
    badge: row.badge ?? undefined,
    sku: row.sku,
    color: row.colour,
    description: row.description,
    details: row.details,
    sizes: row.sizes.length > 0 ? row.sizes : undefined,
    stock: row.stockQuantity,
  };
}

function toProducts(rows: ProductRow[]) {
  return rows.map(toProduct).filter((p): p is Product => p !== null);
}

export const getProduct = cache(async (slug: string) => {
  const row = await db.query.products.findFirst({
    where: eq(products.slug, slug),
    with: withRelations,
  });
  return (row && toProduct(row)) ?? undefined;
});

export const getCategory = cache(async (slug: string) => {
  const [row] = await db
    .select({ slug: categories.slug, name: categories.name })
    .from(categories)
    .where(eq(categories.slug, slug));
  return row;
});

/** Every category in house order: slugs for generateStaticParams, names for links. */
export async function getCategories() {
  return db
    .select({ slug: categories.slug, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.position));
}

export async function getProductSlugs() {
  const rows = await db.select({ slug: products.slug }).from(products);
  return rows.map((row) => row.slug);
}

export async function getNewArrivals(limit = 8) {
  const rows = await db.query.products.findMany({
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return toProducts(rows);
}

export async function getProductsByCategory(slug: string, limit?: number) {
  const rows = await db.query.products.findMany({
    where: eq(products.categoryId, categoryIdBySlug(slug)),
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return toProducts(rows);
}

/** Same-category products first, then the rest of the catalog. */
export async function getRelatedProducts(product: Product, limit = 4) {
  const rows = await db.query.products.findMany({
    where: ne(products.slug, product.slug),
    with: withRelations,
    orderBy: [
      desc(
        sql`${products.categoryId} = ${categoryIdBySlug(product.category.slug)}`,
      ),
      desc(products.createdAt),
    ],
    limit,
  });
  return toProducts(rows);
}
