"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { removeFromBag, updateBagQuantity } from "@/lib/cart-actions";
import { emptyCartState } from "@/lib/cart-form-state";
import { type BagLine, MAX_QUANTITY } from "@/lib/cart-types";
import { formatPrice } from "@/lib/format";

/** One bag line: packshot, details, quantity select and Remove. */
export function BagLineItem({ line }: { line: BagLine }) {
  const [quantityState, quantityAction, quantityPending] = useActionState(
    updateBagQuantity,
    emptyCartState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeFromBag,
    emptyCartState,
  );
  const error = quantityState.error ?? removeState.error;
  const href = `/products/${line.slug}`;

  // Offer no more than is in stock, but keep the current quantity selectable
  // so the select never shows a number the bag doesn't hold.
  const ceiling = Math.min(MAX_QUANTITY, Math.max(line.stock, line.quantity));
  const options = Array.from({ length: ceiling }, (_, i) => i + 1);

  return (
    <li className="grid grid-cols-[6rem_1fr] gap-4 py-6 hairline-b sm:grid-cols-[8rem_1fr] sm:gap-6">
      <Link href={href} className="relative block aspect-product bg-surface">
        {line.image && (
          <Image
            src={line.image.src}
            alt={line.image.alt}
            fill
            sizes="(min-width: 30rem) 8rem, 6rem"
            className="object-cover"
          />
        )}
      </Link>

      <div className="stack gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="stack gap-1">
            <Link href={href} className="text-body-sm font-medium">
              {line.name}
            </Link>
            <p className="type-meta">{line.color}</p>
            {line.size && <p className="type-meta">Size {line.size}</p>}
            {line.quantity > 1 && (
              <p className="type-meta">{formatPrice(line.unitPriceCents)} each</p>
            )}
          </div>
          <p className="type-price">{formatPrice(line.lineTotalCents)}</p>
        </div>

        {line.unavailable && (
          <p className="text-body-sm text-danger">
            {line.stock <= 0
              ? "Sold out. Remove it to check out."
              : `Only ${line.stock} left${line.size ? " across all sizes" : ""}. Lower the quantity to check out.`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <div className="cluster mt-auto gap-6">
          <form action={quantityAction} className="flex items-center gap-3">
            <input type="hidden" name="itemId" value={line.id} />
            <label htmlFor={`qty-${line.id}`} className="text-body-sm">
              Quantity
            </label>
            {/* Keyed on the saved quantity: React resets the form after the
                action, and a fresh select takes the new value as its default
                instead of snapping back to the old one. */}
            <select
              key={line.quantity}
              id={`qty-${line.id}`}
              name="quantity"
              defaultValue={line.quantity}
              autoComplete="off"
              disabled={quantityPending}
              className="field w-16 min-h-10 px-3 tabular-nums"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              {options.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <noscript>
              <button type="submit" className="link text-body-sm">
                Update
              </button>
            </noscript>
          </form>

          <form action={removeAction}>
            <input type="hidden" name="itemId" value={line.id} />
            <button
              type="submit"
              disabled={removePending}
              className="link text-body-sm cursor-pointer"
            >
              {removePending ? "Removing…" : "Remove"}
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}
