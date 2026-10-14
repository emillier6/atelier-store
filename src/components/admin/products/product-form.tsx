"use client";

import Link from "next/link";
import { type FormEvent, startTransition, useActionState } from "react";
import {
  FormStatus,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/admin/form-fields";
import { createProduct, updateProduct } from "@/lib/admin-product-actions";
import { emptyAdminState } from "@/lib/admin-form-state";
import { ImageRows, type ImageRowValue } from "./image-rows";
import { STATUS_OPTIONS } from "./product-form-options";

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  colour: string;
  /** Dollars as typed, e.g. "295" or "29.50". */
  price: string;
  badge: string;
  description: string;
  details: string;
  sizes: string;
  status: string;
  images: ImageRowValue[];
};

type ProductFormProps = {
  mode: "create" | "edit";
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  /** The saved slug, for the "old URL stops working" hint. */
  savedSlug?: string;
};

/**
 * Create and edit form for a product. Submitted by hand rather than through
 * <form action>: React resets a form after its action runs, which would wipe
 * the typed values and snap the selects back after an error. After a save
 * the fields keep what was typed; the action normalises it the same way on
 * every save (lowercased slug, canonical image URLs).
 */
export function ProductForm({
  mode,
  initial,
  categories,
  savedSlug,
}: ProductFormProps) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createProduct : updateProduct,
    emptyAdminState,
  );
  const errors = state.fieldErrors ?? {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={submit} className="stack gap-8" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          name="name"
          label="Name"
          defaultValue={initial.name}
          maxLength={120}
          required
          error={errors.name}
        />
        <TextField
          name="slug"
          label="Slug"
          defaultValue={initial.slug}
          maxLength={120}
          required
          autoCapitalize="none"
          spellCheck={false}
          hint={
            savedSlug
              ? `The page lives at /products/${savedSlug}. Changing the slug makes that URL stop working.`
              : "Lowercase words and hyphens; the page will be /products/<slug>."
          }
          error={errors.slug}
        />
        <TextField
          name="sku"
          label="SKU"
          defaultValue={initial.sku}
          maxLength={64}
          required
          spellCheck={false}
          error={errors.sku}
        />
        <SelectField
          name="categoryId"
          label="Category"
          defaultValue={initial.categoryId}
          options={[
            ...(initial.categoryId
              ? []
              : [{ value: "", label: "Choose a category" }]),
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          required
          error={errors.categoryId}
        />
        <TextField
          name="colour"
          label="Colour"
          defaultValue={initial.colour}
          maxLength={60}
          required
          error={errors.colour}
        />
        <TextField
          name="price"
          label="Price (USD)"
          defaultValue={initial.price}
          inputMode="decimal"
          placeholder="295 or 29.50"
          required
          error={errors.price}
        />
        <TextField
          name="badge"
          label="Badge (optional)"
          defaultValue={initial.badge}
          maxLength={40}
          hint='A short tag on the card, e.g. "New".'
          error={errors.badge}
        />
        <SelectField
          name="status"
          label="Status"
          defaultValue={initial.status}
          options={STATUS_OPTIONS}
          hint="Only active products are shown to customers."
          error={errors.status}
        />
        {mode === "create" && (
          <TextField
            name="stock"
            label="Initial stock"
            defaultValue="0"
            inputMode="numeric"
            hint="Shared by every size. Change it later in the Stock section."
            error={errors.stock}
          />
        )}
      </div>

      <TextAreaField
        name="description"
        label="Description"
        defaultValue={initial.description}
        rows={5}
        maxLength={4000}
        required
        error={errors.description}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <TextAreaField
          name="details"
          label="Details"
          defaultValue={initial.details}
          rows={6}
          hint="One per line."
          error={errors.details}
        />
        <TextAreaField
          name="sizes"
          label="Sizes"
          defaultValue={initial.sizes}
          rows={6}
          hint="One per line, in display order. Leave empty for one size."
          error={errors.sizes}
        />
      </div>

      <ImageRows initial={initial.images} errors={errors} />

      <div className="hairline-t flex flex-wrap items-center gap-4 pt-6">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create product"
              : "Save changes"}
        </button>
        <Link href="/admin/products" className="link text-body-sm">
          Back to products
        </Link>
        <div aria-live="polite">
          <FormStatus error={state.error} saved={state.saved} />
        </div>
      </div>
    </form>
  );
}
