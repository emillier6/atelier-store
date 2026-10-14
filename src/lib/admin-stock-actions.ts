"use server";

import { revalidatePath } from "next/cache";
import {
  type AdminFormState,
  FIELD_ERRORS_MESSAGE,
  submittedValues,
} from "@/lib/admin-form-state";
import { adjustStock, setStock, type StockWriteResult } from "@/lib/admin-stock";
import { adminStockReasons, MAX_STOCK } from "@/lib/admin-stock-form-state";
import {
  cataloguePaths,
  revalidateCatalogue,
} from "@/lib/catalogue-paths";
import { field, readInt, readOneOf, readUuid } from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";

/*
 * The product page's stock forms. Actions can be POSTed to directly, so every
 * field is checked here; the acting admin comes from the session, never the
 * form. The writes live in src/lib/admin-stock.ts.
 */

const NOT_FOUND = "This product no longer exists.";

function refresh(productId: string, result: StockWriteResult) {
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  if (result.ok) {
    revalidateCatalogue(
      cataloguePaths({
        productSlugs: [result.productSlug],
        categorySlugs: [result.categorySlug],
      }),
    );
  }
}

/** Sets the count to a number, if it is still what the admin saw. */
export async function setStockAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin("/admin/products");
  const values = submittedValues(formData);
  const productId = readUuid(formData, "productId");
  if (!productId.ok) return { error: NOT_FOUND, values };

  const errors: Record<string, string> = {};
  const quantity = field(
    errors,
    "quantity",
    readInt(formData, "quantity", { min: 0, max: MAX_STOCK }),
  );
  const expected = readInt(formData, "expected", { min: 0, max: Infinity });
  if (quantity === undefined) {
    return { error: FIELD_ERRORS_MESSAGE, fieldErrors: errors, values };
  }
  if (!expected.ok) {
    return { error: "Reload the page and try again.", values };
  }
  if (quantity === expected.value) {
    return { error: null, saved: "No change.", values };
  }

  const result = await setStock({
    productId: productId.value,
    expected: expected.value,
    quantity,
    reason: "correction",
  });
  refresh(productId.value, result);

  if (result.ok) return { error: null, saved: `Stock set to ${result.stock}.` };
  if (result.current === null) return { error: NOT_FOUND, values };
  return {
    error: `Stock changed to ${result.current} since you loaded the page. Check and try again.`,
    values,
  };
}

/** Adds or removes a number of pieces, with a reason. */
export async function adjustStockAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin("/admin/products");
  const values = submittedValues(formData);
  const productId = readUuid(formData, "productId");
  if (!productId.ok) return { error: NOT_FOUND, values };

  const errors: Record<string, string> = {};
  const delta = field(
    errors,
    "delta",
    readInt(formData, "delta", { min: -MAX_STOCK, max: MAX_STOCK }),
  );
  const reason = field(
    errors,
    "reason",
    readOneOf(formData, "reason", adminStockReasons),
  );
  if (delta === 0) errors.delta = "Enter a number other than 0.";
  if (delta !== undefined && delta < 0 && reason === "restock") {
    errors.reason = "A restock adds pieces. Use Correction to remove them.";
  }
  if (delta === undefined || reason === undefined || Object.keys(errors).length) {
    return { error: FIELD_ERRORS_MESSAGE, fieldErrors: errors, values };
  }

  const result = await adjustStock({
    productId: productId.value,
    delta,
    reason,
  });
  refresh(productId.value, result);

  if (result.ok) {
    const verb = delta > 0 ? `Added ${delta}` : `Removed ${-delta}`;
    return { error: null, saved: `${verb}. Stock is now ${result.stock}.` };
  }
  if (result.current === null) return { error: NOT_FOUND, values };
  const message =
    result.current + delta < 0
      ? `That would take stock below zero. There are ${result.current} left.`
      : `That would take stock above ${MAX_STOCK.toLocaleString("en-US")}.`;
  return { error: message, values };
}
