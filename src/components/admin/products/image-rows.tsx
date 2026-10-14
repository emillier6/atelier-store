"use client";

import Image from "next/image";
import { useState } from "react";
import { MAX_IMAGES, readImageUrl } from "./product-form-options";

export type ImageRowValue = { url: string; alt: string };

type Row = ImageRowValue & { key: number };

type ImageRowsProps = {
  initial: ImageRowValue[];
  /** The action's fieldErrors: `images` for the list, `images.N.url|alt` per row. */
  errors?: Record<string, string>;
};

/**
 * The ordered image list: one URL + alt text per row, with move and remove.
 * Submitted as `imageCount` and `images.N.url` / `images.N.alt`; the first
 * row is the primary image. The action validates every row again.
 */
export function ImageRows({ initial, errors = {} }: ImageRowsProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((image, key) => ({ ...image, key })),
  );
  const [nextKey, setNextKey] = useState(initial.length);

  function update(index: number, patch: Partial<ImageRowValue>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function move(index: number, by: -1 | 1) {
    setRows((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function add() {
    setRows((current) => [...current, { key: nextKey, url: "", alt: "" }]);
    setNextKey((k) => k + 1);
  }

  const listError = errors.images;

  return (
    <fieldset
      className="stack gap-4"
      aria-describedby={listError ? "images-error" : "images-hint"}
    >
      <legend className="text-body-sm font-medium">Images</legend>
      <p id="images-hint" className="type-meta -mt-2">
        Unsplash photo addresses (https://images.unsplash.com/photo-…). The
        first image is the one grids show. Products without images are hidden
        from the storefront.
      </p>
      <input type="hidden" name="imageCount" value={rows.length} />

      {rows.length === 0 && (
        <p className="text-body-sm text-muted">No images yet.</p>
      )}

      <ol className="stack gap-4">
        {rows.map((row, index) => {
          const urlName = `images.${index}.url`;
          const altName = `images.${index}.alt`;
          const preview = row.url ? readImageUrl(row.url.trim()) : null;
          const urlError = errors[urlName];
          const altError = errors[altName];

          return (
            <li key={row.key} className="hairline-b flex gap-4 pb-4">
              <div className="relative h-20 w-16 shrink-0 bg-surface">
                {preview?.ok && (
                  <Image
                    src={preview.value}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="stack min-w-0 flex-1 gap-3">
                <p className="type-meta">
                  {index === 0 ? "1 · Primary" : index + 1}
                </p>
                <div className="stack gap-2">
                  <label htmlFor={urlName} className="sr-only">
                    Image {index + 1} URL
                  </label>
                  <input
                    id={urlName}
                    name={urlName}
                    className="field"
                    type="url"
                    inputMode="url"
                    placeholder="https://images.unsplash.com/photo-…"
                    value={row.url}
                    onChange={(e) => update(index, { url: e.target.value })}
                    aria-invalid={urlError ? true : undefined}
                    aria-describedby={urlError ? `${urlName}-error` : undefined}
                  />
                  {urlError && (
                    <p id={`${urlName}-error`} className="field-error">
                      {urlError}
                    </p>
                  )}
                </div>
                <div className="stack gap-2">
                  <label htmlFor={altName} className="sr-only">
                    Image {index + 1} alt text
                  </label>
                  <input
                    id={altName}
                    name={altName}
                    className="field"
                    placeholder="Alt text, e.g. Ivory silk shirt, front"
                    maxLength={200}
                    value={row.alt}
                    onChange={(e) => update(index, { alt: e.target.value })}
                    aria-invalid={altError ? true : undefined}
                    aria-describedby={altError ? `${altName}-error` : undefined}
                  />
                  {altError && (
                    <p id={`${altName}-error`} className="field-error">
                      {altError}
                    </p>
                  )}
                </div>
                <div className="cluster gap-4 text-body-sm">
                  <button
                    type="button"
                    className="link cursor-pointer disabled:cursor-not-allowed disabled:text-muted"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="link cursor-pointer disabled:cursor-not-allowed disabled:text-muted"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="link cursor-pointer"
                    onClick={() => remove(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {listError && (
        <p id="images-error" className="field-error">
          {listError}
        </p>
      )}

      {rows.length < MAX_IMAGES && (
        <div>
          <button type="button" className="btn btn-outline btn-sm" onClick={add}>
            Add image
          </button>
        </div>
      )}
    </fieldset>
  );
}
