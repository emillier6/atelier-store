// Loads the initial catalog. Safe to re-run: rows are upserted by slug, and
// stock is reset to the seed quantities. Run with `pnpm db:seed`.
import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "./index";
import { categories, products, productStock } from "./schema";
import * as data from "./seed-data";

// Fixed base so re-seeding doesn't reorder "New Arrivals".
const SEEDED_AT = Date.parse("2026-09-01T00:00:00Z");
const HOUR = 60 * 60 * 1000;

function excluded(column: PgColumn): SQL {
  return sql.raw(`excluded."${column.name}"`);
}

async function main() {
  const categoryRows = await db
    .insert(categories)
    .values(data.categories.map((c, position) => ({ ...c, position })))
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: excluded(categories.name),
        position: excluded(categories.position),
      },
    })
    .returning({ id: categories.id, name: categories.name });

  const categoryIds = new Map(categoryRows.map((c) => [c.name, c.id]));

  const productRows = await db
    .insert(products)
    .values(
      data.products.map((p, i) => {
        const categoryId = categoryIds.get(p.category);
        if (categoryId === undefined) {
          throw new Error(`Unknown category "${p.category}" for ${p.slug}`);
        }
        return {
          categoryId,
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          description: p.description,
          color: p.color,
          priceCents: p.price,
          badge: p.badge ?? null,
          images: [p.image, ...(p.gallery ?? [])],
          details: p.details,
          sizes: p.sizes ?? [],
          // Listed newest first.
          createdAt: new Date(SEEDED_AT - i * HOUR),
        };
      }),
    )
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        categoryId: excluded(products.categoryId),
        sku: excluded(products.sku),
        name: excluded(products.name),
        description: excluded(products.description),
        color: excluded(products.color),
        priceCents: excluded(products.priceCents),
        badge: excluded(products.badge),
        images: excluded(products.images),
        details: excluded(products.details),
        sizes: excluded(products.sizes),
        createdAt: excluded(products.createdAt),
      },
    })
    .returning({ id: products.id, slug: products.slug });

  const stockBySlug = new Map(data.products.map((p) => [p.slug, p.stock]));

  await db
    .insert(productStock)
    .values(
      productRows.map((p) => ({
        productId: p.id,
        quantity: stockBySlug.get(p.slug) ?? 0,
      })),
    )
    .onConflictDoUpdate({
      target: productStock.productId,
      set: { quantity: excluded(productStock.quantity) },
    });

  console.log(
    `Seeded ${categoryRows.length} categories, ${productRows.length} products.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
