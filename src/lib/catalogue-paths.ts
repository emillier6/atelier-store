import "server-only";
import { revalidatePath } from "next/cache";

/*
 * Catalogue pages are static with `revalidate = 60`. Anything that changes
 * what they show (a sale lowering stock, an admin edit) refreshes them here
 * so the change shows on the next visit instead of up to a minute later.
 */

/**
 * The pages that show these products and categories: /, /new-arrivals, each
 * /products/[slug] and each /collections/[slug]. Pass old and new slugs when
 * one changed, so both the old and the new URL are refreshed.
 */
export function cataloguePaths({
  productSlugs = [],
  categorySlugs = [],
}: {
  productSlugs?: string[];
  categorySlugs?: string[];
}) {
  const paths = new Set(["/", "/new-arrivals"]);
  for (const slug of productSlugs) paths.add(`/products/${slug}`);
  for (const slug of categorySlugs) paths.add(`/collections/${slug}`);
  return [...paths];
}

/**
 * Revalidates the paths. Never throws: the write that called it has already
 * happened, and the pages fall back to their 60s revalidate.
 */
export function revalidateCatalogue(paths: string[]) {
  try {
    for (const path of paths) revalidatePath(path);
  } catch (error) {
    console.error("Catalogue revalidation failed", paths, error);
  }
}
