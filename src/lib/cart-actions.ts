"use server";

import { revalidatePath } from "next/cache";
import {
  addItem,
  getProductForBag,
  removeItem,
  setQuantity,
} from "@/lib/cart";
import type { CartFormState } from "@/lib/cart-form-state";
import { MAX_QUANTITY } from "@/lib/cart-types";
import { requireUser } from "@/lib/session";

/*
 * Bag mutations. The browser only sends a slug, a size, a line id and a
 * quantity; prices never leave the server. Actions can be POSTed to without
 * our forms, so every field is validated and every write is scoped to the
 * caller's own bag.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readItemId(formData: FormData) {
  const id = readString(formData, "itemId").toLowerCase();
  return UUID_PATTERN.test(id) ? id : null;
}

export async function addToBag(
  _prev: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  const slug = readString(formData, "slug");
  if (!SLUG_PATTERN.test(slug)) {
    return { error: "This piece could not be added." };
  }

  // There is no guest bag: sign in, then come back to the product page.
  const user = await requireUser(`/products/${slug}`);

  const product = await getProductForBag(slug);
  if (!product) return { error: "This piece could not be added." };
  if (product.stockQuantity <= 0) return { error: "This piece is sold out." };

  let size: string | null = null;
  if (product.sizes.length > 0) {
    size = readString(formData, "size");
    if (!product.sizes.includes(size)) return { error: "Select a size." };
  }

  await addItem(
    user.id,
    { productId: product.id, size, quantity: 1 },
    Math.min(MAX_QUANTITY, product.stockQuantity),
  );

  // Only the bag: the product page is static and shared by every visitor.
  revalidatePath("/bag");
  return { error: null, added: true };
}

export async function updateBagQuantity(
  _prev: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  const itemId = readItemId(formData);
  const quantity = Number(readString(formData, "quantity"));
  if (
    !itemId ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY
  ) {
    return { error: "The quantity could not be changed." };
  }

  const user = await requireUser("/bag");
  await setQuantity(user.id, itemId, quantity);
  revalidatePath("/bag");
  return { error: null };
}

export async function removeFromBag(
  _prev: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  const itemId = readItemId(formData);
  if (!itemId) return { error: "This piece could not be removed." };

  const user = await requireUser("/bag");
  await removeItem(user.id, itemId);
  revalidatePath("/bag");
  return { error: null };
}
