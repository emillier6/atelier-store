"use client";

import { useId, useState } from "react";
import { BagIcon } from "@/components/icons";
import type { StockState } from "@/lib/catalog";

type ProductPurchaseProps = {
  sizes?: string[];
  stockState: StockState;
};

type Status = "idle" | "size-required" | "added";

export function ProductPurchase({ sizes, stockState }: ProductPurchaseProps) {
  const [size, setSize] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const statusId = useId();
  const soldOut = stockState === "out_of_stock";
  const needsSize = Boolean(sizes?.length);

  function addToBag() {
    if (needsSize && !size) {
      setStatus("size-required");
      return;
    }
    // TODO: persist to the cart once it exists.
    setStatus("added");
  }

  return (
    <div className="stack gap-6">
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
                    setStatus("idle");
                  }}
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={soldOut}
        aria-describedby={statusId}
        onClick={addToBag}
      >
        <BagIcon />
        {soldOut ? "Sold out" : "Add to bag"}
      </button>

      <p
        id={statusId}
        aria-live="polite"
        className={`-mt-3 text-body-sm empty:hidden ${status === "size-required" ? "text-danger" : ""}`}
      >
        {status === "size-required" && "Please select a size."}
        {status === "added" &&
          `Added to your bag${size ? ` in size ${size}` : ""}.`}
      </p>
    </div>
  );
}
