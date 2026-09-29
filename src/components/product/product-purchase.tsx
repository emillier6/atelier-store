"use client";

import Link from "next/link";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useId,
  useState,
} from "react";
import { BagIcon } from "@/components/icons";
import { addToBag } from "@/lib/cart-actions";
import { emptyCartState } from "@/lib/cart-form-state";
import type { StockState } from "@/lib/catalog";

type ProductPurchaseProps = {
  slug: string;
  sizes?: string[];
  stockState: StockState;
};

/**
 * Size picker and Add to bag. The action checks the size and stock again
 * on the server; a signed-out visitor is sent to sign in and back here.
 */
export function ProductPurchase({
  slug,
  sizes,
  stockState,
}: ProductPurchaseProps) {
  const [state, action, pending] = useActionState(addToBag, emptyCartState);
  const [size, setSize] = useState<string | null>(null);
  const [sizeMissing, setSizeMissing] = useState(false);
  const statusId = useId();
  const soldOut = stockState === "out_of_stock";
  const needsSize = Boolean(sizes?.length);

  // Submitted by hand rather than through <form action>: React resets a form
  // after its action runs, which would untick the chosen size while `size`
  // still holds it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsSize && !size) {
      setSizeMissing(true);
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={submit} className="stack gap-6">
      <input type="hidden" name="slug" value={slug} />

      {sizes && sizes.length > 0 && (
        <fieldset disabled={soldOut}>
          <legend className="mb-3 text-body-sm">
            Size{size && <span className="font-semibold"> {size}</span>}
          </legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {sizes.map((s) => (
              <label
                key={s}
                className="flex h-11 cursor-pointer items-center justify-center border border-line text-body-sm transition-colors duration-300 ease-luxe hover:border-line-strong has-checked:border-line-strong has-checked:font-semibold has-focus-visible:outline has-focus-visible:outline-offset-2 has-focus-visible:outline-line-strong has-disabled:cursor-not-allowed has-disabled:text-muted has-disabled:hover:border-line"
              >
                <input
                  type="radio"
                  name="size"
                  value={s}
                  className="sr-only"
                  checked={size === s}
                  onChange={() => {
                    setSize(s);
                    setSizeMissing(false);
                  }}
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={soldOut || pending}
        aria-describedby={statusId}
      >
        <BagIcon />
        {soldOut ? "Sold out" : pending ? "Adding…" : "Add to bag"}
      </button>

      <p
        id={statusId}
        aria-live="polite"
        className={`-mt-3 text-body-sm empty:hidden ${sizeMissing || state.error ? "text-danger" : ""}`}
      >
        {sizeMissing
          ? "Select a size."
          : state.error ??
            (state.added && (
              <>
                Added to your bag.{" "}
                <Link href="/bag" className="link">
                  View bag
                </Link>
              </>
            ))}
      </p>
    </form>
  );
}
