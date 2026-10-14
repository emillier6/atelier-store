"use client";

import { useActionState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormStatus } from "@/components/admin/form-fields";
import { deleteProduct, setProductStatus } from "@/lib/admin-product-actions";
import { emptyAdminState } from "@/lib/admin-form-state";

type ProductLifecycleProps = {
  productId: string;
  status: string;
  /** Ordered products can't be deleted, only archived. */
  hasOrders: boolean;
};

/** Archive / move to draft, and delete for products never ordered. */
export function ProductLifecycle({
  productId,
  status,
  hasOrders,
}: ProductLifecycleProps) {
  const [statusState, statusAction, statusPending] = useActionState(
    setProductStatus,
    emptyAdminState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteProduct,
    emptyAdminState,
  );
  const target = status === "archived" ? "draft" : "archived";

  return (
    <div className="stack gap-8">
      <form action={statusAction} className="stack gap-3">
        <input type="hidden" name="id" value={productId} />
        <input type="hidden" name="status" value={target} />
        <p className="text-body-sm text-muted">
          {target === "archived"
            ? "Archiving withdraws it from sale and keeps it for order history. Customers can't see or buy it."
            : "Moving it to draft keeps it hidden while you edit it. Set it to active in the form above to sell it again."}
        </p>
        <div className="cluster gap-4">
          <button
            type="submit"
            className="btn btn-outline btn-sm"
            disabled={statusPending}
          >
            {statusPending
              ? "Working…"
              : target === "archived"
                ? "Archive"
                : "Move to draft"}
          </button>
          <FormStatus error={statusState.error} saved={statusState.saved} />
        </div>
      </form>

      {hasOrders ? (
        <p className="text-body-sm text-muted">
          This product has been ordered, so it can&apos;t be deleted: its
          order lines refer to it. Archive it instead.
        </p>
      ) : (
        <form action={deleteAction} className="stack gap-3">
          <input type="hidden" name="id" value={productId} />
          <p className="text-body-sm text-muted">
            Deleting removes the product, its images and its stock history,
            and takes it out of every customer&apos;s bag. This can&apos;t be
            undone.
          </p>
          <div className="cluster gap-4">
            <ConfirmButton
              label="Delete product"
              question="Delete this product for good?"
              confirmLabel="Delete for good"
              pending={deletePending}
            />
            <FormStatus error={deleteState.error} />
          </div>
        </form>
      )}
    </div>
  );
}
