"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories } from "@/db/schema";
import {
  categoryProductSlugs,
  countCategoryProducts,
} from "@/lib/admin-categories";
import {
  FIELD_ERRORS_MESSAGE,
  submittedValues,
  type AdminFormState,
} from "@/lib/admin-form-state";
import { cataloguePaths, revalidateCatalogue } from "@/lib/catalogue-paths";
import { field, readInt, readSlug, readText, readUuid } from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";

/*
 * Category writes. Each action checks the admin and every field itself:
 * Server Actions can be POSTed to without our forms.
 */

const LIST_PATH = "/admin/categories";
const SLUG_TAKEN = "Another category uses this slug.";

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

/** Drizzle wraps driver errors, so look at the cause chain for the code. */
function hasPgCode(error: unknown, code: string) {
  for (let e = error; e && typeof e === "object"; e = (e as Error).cause) {
    if ((e as { code?: unknown }).code === code) return true;
  }
  return false;
}

/** Name, slug and position, or the field errors. */
function readCategory(formData: FormData) {
  const errors: Record<string, string> = {};
  const name = field(errors, "name", readText(formData, "name", { max: 80 }));
  const slug = field(errors, "slug", readSlug(formData, "slug"));
  const position = field(
    errors,
    "position",
    readInt(formData, "position", { min: 0, max: 1000 }),
  );
  if (Object.keys(errors).length || !name || !slug || position === undefined) {
    return { ok: false as const, errors };
  }
  return { ok: true as const, value: { name, slug, position } };
}

function fieldErrorState(
  formData: FormData,
  fieldErrors: Record<string, string>,
): AdminFormState {
  return {
    error: FIELD_ERRORS_MESSAGE,
    fieldErrors,
    values: submittedValues(formData),
  };
}

export async function createCategory(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin(`${LIST_PATH}/new`);

  const input = readCategory(formData);
  if (!input.ok) return fieldErrorState(formData, input.errors);

  try {
    await db.insert(categories).values(input.value);
  } catch (error) {
    if (hasPgCode(error, UNIQUE_VIOLATION)) {
      return fieldErrorState(formData, { slug: SLUG_TAKEN });
    }
    console.error("Creating a category failed", error);
    return {
      error: "Couldn't save the category. Try again.",
      values: submittedValues(formData),
    };
  }

  revalidateCatalogue(cataloguePaths({ categorySlugs: [input.value.slug] }));
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateCategory(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const idRead = readUuid(formData, "id");
  await requireAdmin(idRead.ok ? `${LIST_PATH}/${idRead.value}` : LIST_PATH);
  if (!idRead.ok) return { error: "This category no longer exists." };
  const id = idRead.value;

  const input = readCategory(formData);
  if (!input.ok) return fieldErrorState(formData, input.errors);

  const [existing] = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, id));
  if (!existing) return { error: "This category no longer exists." };

  try {
    await db.update(categories).set(input.value).where(eq(categories.id, id));
  } catch (error) {
    if (hasPgCode(error, UNIQUE_VIOLATION)) {
      return fieldErrorState(formData, { slug: SLUG_TAKEN });
    }
    console.error("Updating a category failed", error);
    return {
      error: "Couldn't save the category. Try again.",
      values: submittedValues(formData),
    };
  }

  // Product pages show the category name in their breadcrumb.
  let productSlugs: string[] = [];
  try {
    productSlugs = await categoryProductSlugs(id);
  } catch (error) {
    console.error("Listing a category's products failed", error);
  }
  revalidateCatalogue(
    cataloguePaths({
      productSlugs,
      categorySlugs: [existing.slug, input.value.slug],
    }),
  );
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);

  return {
    error: null,
    saved: "Saved.",
    values: {
      id,
      name: input.value.name,
      slug: input.value.slug,
      position: String(input.value.position),
    },
  };
}

export async function deleteCategory(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const idRead = readUuid(formData, "id");
  await requireAdmin(idRead.ok ? `${LIST_PATH}/${idRead.value}` : LIST_PATH);
  if (!idRead.ok) return { error: "This category no longer exists." };
  const id = idRead.value;

  const productCount = await countCategoryProducts(id);
  if (productCount > 0) {
    return {
      error: `Move its ${productCount} ${productCount === 1 ? "product" : "products"} to another category first.`,
    };
  }

  let deleted: { slug: string } | undefined;
  try {
    [deleted] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ slug: categories.slug });
  } catch (error) {
    // A product was added between the count and the delete.
    if (hasPgCode(error, FOREIGN_KEY_VIOLATION)) {
      return { error: "Move its products to another category first." };
    }
    console.error("Deleting a category failed", error);
    return { error: "Couldn't delete the category. Try again." };
  }
  if (!deleted) return { error: "This category no longer exists." };

  revalidateCatalogue(cataloguePaths({ categorySlugs: [deleted.slug] }));
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
