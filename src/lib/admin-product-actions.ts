"use server";

import { and, eq, notExists } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MAX_IMAGES,
  readImageUrl,
} from "@/components/admin/products/product-form-options";
import { db } from "@/db";
import {
  categories,
  orderItems,
  productImages,
  products,
  productStatuses,
  type ProductStatus,
} from "@/db/schema";
import {
  type AdminFormState,
  FIELD_ERRORS_MESSAGE,
  submittedValues,
} from "@/lib/admin-form-state";
import { cataloguePaths, revalidateCatalogue } from "@/lib/catalogue-paths";
import {
  field,
  readCents,
  readInt,
  readLines,
  readOneOf,
  readSlug,
  readText,
  readUuid,
} from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";

const LIST_PATH = "/admin/products";

type ImageInput = { url: string; alt: string };

type ProductInput = {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  colour: string;
  priceCents: number;
  badge: string | null;
  description: string;
  details: string[];
  sizes: string[];
  status: ProductStatus;
  images: ImageInput[];
};

/**
 * The image rows arrive as `imageCount` plus `images.N.url` / `images.N.alt`
 * (indexed names, so `submittedValues` can echo every row). Fully blank rows
 * are dropped; every other row needs an Unsplash URL and alt text.
 */
function readImages(formData: FormData, errors: Record<string, string>) {
  const countRead = readInt(formData, "imageCount", { min: 0, max: 50 });
  if (!countRead.ok) {
    errors.images = "The image list was not sent correctly. Reload and try again.";
    return [];
  }
  const images: ImageInput[] = [];
  for (let i = 0; i < countRead.value; i++) {
    const urlKey = `images.${i}.url`;
    const altKey = `images.${i}.alt`;
    const rawUrl = String(formData.get(urlKey) ?? "").trim();
    const alt = readText(formData, altKey, { max: 200, optional: true });
    if (!rawUrl && alt.ok && alt.value === null) continue;

    const url = rawUrl ? readImageUrl(rawUrl) : null;
    if (!url) errors[urlKey] = "Required.";
    else if (!url.ok) errors[urlKey] = url.error;
    if (!alt.ok) errors[altKey] = alt.error;
    else if (alt.value === null) errors[altKey] = "Describe the image.";

    if (url?.ok && alt.ok && alt.value) {
      images.push({ url: url.value, alt: alt.value });
    }
  }
  if (images.length > MAX_IMAGES && !errors.images) {
    errors.images = `Keep it to ${MAX_IMAGES} images.`;
  }
  return images;
}

/** Every product field, or the field errors. Never trusts the markup. */
function readProduct(formData: FormData) {
  const errors: Record<string, string> = {};
  const name = field(errors, "name", readText(formData, "name", { max: 120 }));
  const slug = field(errors, "slug", readSlug(formData, "slug"));
  const sku = field(errors, "sku", readText(formData, "sku", { max: 64 }));
  const categoryId = field(errors, "categoryId", readUuid(formData, "categoryId"));
  const colour = field(errors, "colour", readText(formData, "colour", { max: 60 }));
  const priceCents = field(errors, "price", readCents(formData, "price"));
  const badge = field(
    errors,
    "badge",
    readText(formData, "badge", { max: 40, optional: true }),
  );
  const description = field(
    errors,
    "description",
    readText(formData, "description", { max: 4000 }),
  );
  const details = field(
    errors,
    "details",
    readLines(formData, "details", { maxItems: 20, maxLength: 200 }),
  );
  const sizes = field(
    errors,
    "sizes",
    readLines(formData, "sizes", { maxItems: 20, maxLength: 20 }),
  );
  if (sizes && new Set(sizes).size !== sizes.length) {
    errors.sizes = "Each size can only be listed once.";
  }
  const status = field(
    errors,
    "status",
    readOneOf(formData, "status", productStatuses),
  );
  const images = readImages(formData, errors);

  const rowErrors = Object.keys(errors).some((k) => k.startsWith("images."));
  if (status === "active" && images.length === 0 && !errors.images && !rowErrors) {
    errors.images = "Add at least one image before making it active.";
  }

  if (Object.keys(errors).length) return { errors };
  return {
    product: {
      name: name!,
      slug: slug!,
      sku: sku!,
      categoryId: categoryId!,
      colour: colour!,
      priceCents: priceCents!,
      badge: badge ?? null,
      description: description!,
      details: details!,
      sizes: sizes!,
      status: status!,
      images,
    } satisfies ProductInput,
  };
}

function productColumns(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    categoryId: input.categoryId,
    colour: input.colour,
    priceCents: input.priceCents,
    badge: input.badge,
    description: input.description,
    details: input.details,
    sizes: input.sizes,
    status: input.status,
  };
}

function imageRows(productId: string, images: ImageInput[]) {
  return images.map((image, position) => ({
    productId,
    url: image.url,
    alt: image.alt,
    position,
  }));
}

async function categorySlug(id: string) {
  const [row] = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, id));
  return row?.slug;
}

const UNIQUE_VIOLATION = "23505";

/** The constraint a unique violation hit, or null for any other error. */
function uniqueViolationConstraint(error: unknown) {
  // Drizzle wraps driver errors, so look at the cause too.
  for (let e = error; e && typeof e === "object"; e = (e as Error).cause) {
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (code === UNIQUE_VIOLATION) {
      return typeof constraint === "string" ? constraint : "";
    }
  }
  return null;
}

/** Field errors for a duplicate slug or SKU, or null to rethrow. */
function duplicateErrors(error: unknown): Record<string, string> | null {
  const constraint = uniqueViolationConstraint(error);
  if (constraint === "products_slug_unique") {
    return { slug: "Another product already uses this slug." };
  }
  if (constraint === "products_sku_unique") {
    return { sku: "Another product already uses this SKU." };
  }
  return null;
}

function revalidateAdmin(id?: string) {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(`${LIST_PATH}/${id}`);
}

/* ------------------------------------------------------------------------ */

export async function createProduct(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin(`${LIST_PATH}/new`);
  const values = submittedValues(formData);

  const { product, errors } = readProduct(formData);
  const stock = readInt(formData, "stock", { min: 0, max: 100_000 });
  const fieldErrors = { ...errors };
  if (!stock.ok) fieldErrors.stock = stock.error;
  if (!product || !stock.ok) {
    return { error: FIELD_ERRORS_MESSAGE, fieldErrors, values };
  }

  const catSlug = await categorySlug(product.categoryId);
  if (!catSlug) {
    return {
      error: FIELD_ERRORS_MESSAGE,
      fieldErrors: { categoryId: "Choose a category." },
      values,
    };
  }

  // neon-http has no interactive transactions: the id is made here so the
  // product and its images go into one db.batch(), which is one transaction.
  const id = crypto.randomUUID();
  const statements: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    db.insert(products).values({
      id,
      ...productColumns(product),
      stockQuantity: stock.value,
    }),
  ];
  if (product.images.length) {
    statements.push(
      db.insert(productImages).values(imageRows(id, product.images)),
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const duplicate = duplicateErrors(error);
    if (!duplicate) throw error;
    return { error: FIELD_ERRORS_MESSAGE, fieldErrors: duplicate, values };
  }

  revalidateCatalogue(
    cataloguePaths({ productSlugs: [product.slug], categorySlugs: [catSlug] }),
  );
  revalidateAdmin();
  redirect(`${LIST_PATH}/${id}?created=1`);
}

export async function updateProduct(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const idRead = readUuid(formData, "id");
  await requireAdmin(idRead.ok ? `${LIST_PATH}/${idRead.value}` : LIST_PATH);
  const values = submittedValues(formData);
  if (!idRead.ok) return { error: "This product no longer exists.", values };
  const id = idRead.value;

  const { product, errors } = readProduct(formData);
  if (!product) return { error: FIELD_ERRORS_MESSAGE, fieldErrors: errors, values };

  const [existing] = await db
    .select({ slug: products.slug, categorySlug: categories.slug })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id));
  if (!existing) return { error: "This product no longer exists.", values };

  const catSlug = await categorySlug(product.categoryId);
  if (!catSlug) {
    return {
      error: FIELD_ERRORS_MESSAGE,
      fieldErrors: { categoryId: "Choose a category." },
      values,
    };
  }

  // Images are replaced wholesale: deleting first means the re-inserted
  // positions never collide with the old ones on (product_id, position).
  // stock_quantity is left alone; the Stock section owns it.
  const statements: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    db.update(products).set(productColumns(product)).where(eq(products.id, id)),
    db.delete(productImages).where(eq(productImages.productId, id)),
  ];
  if (product.images.length) {
    statements.push(
      db.insert(productImages).values(imageRows(id, product.images)),
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const duplicate = duplicateErrors(error);
    if (!duplicate) throw error;
    return { error: FIELD_ERRORS_MESSAGE, fieldErrors: duplicate, values };
  }

  revalidateCatalogue(
    cataloguePaths({
      productSlugs: [existing.slug, product.slug],
      categorySlugs: [existing.categorySlug, catSlug],
    }),
  );
  revalidateAdmin(id);
  return { error: null, saved: "Saved." };
}

/**
 * Archive or move back to draft from the edit page. Making a product active
 * goes through the full form, which checks it has images.
 */
export async function setProductStatus(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const idRead = readUuid(formData, "id");
  await requireAdmin(idRead.ok ? `${LIST_PATH}/${idRead.value}` : LIST_PATH);
  const status = readOneOf(formData, "status", ["draft", "archived"] as const);
  if (!idRead.ok || !status.ok) return { error: "Something went wrong. Reload and try again." };

  const [row] = await db
    .update(products)
    .set({ status: status.value })
    .where(eq(products.id, idRead.value))
    .returning({ slug: products.slug, categoryId: products.categoryId });
  if (!row) return { error: "This product no longer exists." };

  const catSlug = await categorySlug(row.categoryId);
  revalidateCatalogue(
    cataloguePaths({
      productSlugs: [row.slug],
      categorySlugs: catSlug ? [catSlug] : [],
    }),
  );
  revalidateAdmin(idRead.value);
  return {
    error: null,
    saved: status.value === "archived" ? "Archived." : "Moved to draft.",
  };
}

/**
 * Hard delete, only for products that were never ordered: the check and the
 * delete are one statement, so an order landing in between can't slip
 * through. Bag lines and stock history cascade.
 */
export async function deleteProduct(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const idRead = readUuid(formData, "id");
  await requireAdmin(idRead.ok ? `${LIST_PATH}/${idRead.value}` : LIST_PATH);
  if (!idRead.ok) return { error: "This product no longer exists." };
  const id = idRead.value;

  const [row] = await db
    .delete(products)
    .where(
      and(
        eq(products.id, id),
        notExists(
          db
            .select({ id: orderItems.id })
            .from(orderItems)
            .where(eq(orderItems.productId, id)),
        ),
      ),
    )
    .returning({ slug: products.slug, categoryId: products.categoryId });

  if (!row) {
    const [still] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id));
    return {
      error: still
        ? "This product has been ordered, so it can't be deleted. Archive it instead."
        : "This product no longer exists.",
    };
  }

  const catSlug = await categorySlug(row.categoryId);
  revalidateCatalogue(
    cataloguePaths({
      productSlugs: [row.slug],
      categorySlugs: catSlug ? [catSlug] : [],
    }),
  );
  revalidateAdmin(id);
  redirect(`${LIST_PATH}?deleted=1`);
}
