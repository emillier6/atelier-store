"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormStatus, TextField } from "@/components/admin/form-fields";
import { createCategory, updateCategory } from "@/lib/admin-category-actions";
import { emptyAdminState } from "@/lib/admin-form-state";

type CategoryFormProps =
  | {
      mode: "create";
      defaults: { position: number };
    }
  | {
      mode: "edit";
      defaults: { id: string; name: string; slug: string; position: number };
    };

/**
 * Name, slug and position. Fields are uncontrolled and refill from the
 * action's `values`, because React resets the form after the action runs.
 */
export function CategoryForm(props: CategoryFormProps) {
  const editing = props.mode === "edit";
  const [state, action, pending] = useActionState(
    editing ? updateCategory : createCategory,
    emptyAdminState,
  );
  const defaults = props.defaults;
  const values = state.values;
  const errors = state.fieldErrors ?? {};
  const currentSlug = editing ? props.defaults.slug : null;

  return (
    <form action={action} className="stack gap-6">
      {editing && <input type="hidden" name="id" value={props.defaults.id} />}

      <TextField
        name="name"
        label="Name"
        required
        maxLength={80}
        autoComplete="off"
        defaultValue={values?.name ?? ("name" in defaults ? defaults.name : "")}
        error={errors.name}
      />
      <TextField
        name="slug"
        label="Slug"
        required
        maxLength={120}
        autoComplete="off"
        spellCheck={false}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        defaultValue={values?.slug ?? ("slug" in defaults ? defaults.slug : "")}
        hint={
          currentSlug
            ? `The collection lives at /collections/${currentSlug}. Changing the slug changes that URL, and old links stop working.`
            : "Lowercase letters, numbers and hyphens. Used in /collections/…"
        }
        error={errors.slug}
      />
      <TextField
        name="position"
        label="Position"
        type="number"
        required
        min={0}
        max={1000}
        step={1}
        inputMode="numeric"
        className="field max-w-40"
        defaultValue={values?.position ?? String(defaults.position)}
        hint="Lower numbers come first."
        error={errors.position}
      />

      <FormStatus error={state.error} saved={state.saved} />

      <div className="cluster gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending
            ? "Saving…"
            : editing
              ? "Save changes"
              : "Create category"}
        </button>
        <Link href="/admin/categories" className="link text-body-sm">
          Back to categories
        </Link>
      </div>
    </form>
  );
}
