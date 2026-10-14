"use client";

import { useActionState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormStatus } from "@/components/admin/form-fields";
import { deleteCategory } from "@/lib/admin-category-actions";
import { emptyAdminState } from "@/lib/admin-form-state";

/** Delete, asked twice. The action refuses while products use the category. */
export function DeleteCategoryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    deleteCategory,
    emptyAdminState,
  );

  return (
    <form action={action} className="stack gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton
        label="Delete category"
        question="Delete this category?"
        confirmLabel="Delete for good"
        pending={pending}
      />
      <FormStatus error={state.error} />
    </form>
  );
}
