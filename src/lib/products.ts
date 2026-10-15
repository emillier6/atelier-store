// Catalog reads for Server Components. Returns the storefront `Product` shape.
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
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

/** Drafts and archived pieces never reach the storefront. */
const isActive = eq(products.status, "active");

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
    where: and(eq(products.slug, slug), isActive),
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
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(isActive);
  return rows.map((row) => row.slug);
}

export async function getNewArrivals(limit = 8) {
  const rows = await db.query.products.findMany({
    where: isActive,
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return toProducts(rows);
}

export async function getProductsByCategory(slug: string, limit?: number) {
  const rows = await db.query.products.findMany({
    where: and(eq(products.categoryId, categoryIdBySlug(slug)), isActive),
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return toProducts(rows);
}

/** Same-category products first, then the rest of the catalog. */
export async function getRelatedProducts(product: Product, limit = 4) {
  const rows = await db.query.products.findMany({
    where: and(ne(products.slug, product.slug), isActive),
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

/**
 * Active products in any of these categories, newest first. Used by the
 * editorial edits, which pick their pieces by category.
 */
export async function getProductsInCategories(slugs: string[], limit = 12) {
  if (slugs.length === 0) return [];
  const list = sql.join(
    slugs.map((slug) => sql`${slug}`),
    sql`, `,
  );
  const rows = await db.query.products.findMany({
    where: and(
      sql`${products.categoryId} in (select c.id from categories c where c.slug in (${list}))`,
      isActive,
    ),
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return toProducts(rows);
}

export const SEARCH_MAX_LENGTH = 80;

/**
 * Active products whose name, colour, SKU or category name contains the
 * query (case-insensitive). LIKE wildcards in the query match literally.
 */
export async function searchProducts(query: string, limit = 48) {
  const term = query.trim().slice(0, SEARCH_MAX_LENGTH);
  if (!term) return [];
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db.query.products.findMany({
    where: and(
      isActive,
      or(
        ilike(products.name, pattern),
        ilike(products.colour, pattern),
        ilike(products.sku, pattern),
        sql`${products.categoryId} in (select c.id from categories c where c.name ilike ${pattern})`,
      ),
    ),
    with: withRelations,
    orderBy: [desc(products.createdAt)],
    limit,
  });
  return toProducts(rows);
}

export type CategoryCover = {
  slug: string;
  name: string;
  image: { src: string; alt: string } | null;
};

/**
 * Every category in house order, with the primary image of its newest active
 * product as a cover (null when it has none on sale).
 */
export async function getCategoryCovers(): Promise<CategoryCover[]> {
  const result = await db.execute<{
    slug: string;
    name: string;
    url: string | null;
    alt: string | null;
  }>(sql`
    select c.slug, c.name, cover.url, cover.alt
    from categories c
    left join lateral (
      select pi.url, pi.alt
      from products p
      join product_images pi on pi.product_id = p.id and pi.position = 0
      where p.category_id = c.id and p.status = 'active'
      order by p.created_at desc
      limit 1
    ) cover on true
    order by c.position, c.name
  `);
  return result.rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    image: row.url ? { src: row.url, alt: row.alt ?? row.name } : null,
  }));
}
