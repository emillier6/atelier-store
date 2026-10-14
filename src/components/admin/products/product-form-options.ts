import { readHttpsUrl, type Read } from "@/lib/form-data";
import { unsplash } from "@/lib/images";

/*
 * Shared by the product form (client) and its Server Actions. No server or
 * DB imports, so the client bundle can use it.
 */

export const MAX_IMAGES = 12;

export const STATUS_OPTIONS = [
  { value: "draft", label: "Draft (hidden)" },
  { value: "active", label: "Active (on sale)" },
  { value: "archived", label: "Archived (withdrawn)" },
];

const UNSPLASH_PHOTO_PATH = /^\/photo-([A-Za-z0-9-]+)$/;

/**
 * next.config.ts only lets next/image load images.unsplash.com/photo-* with
 * our fixed query string, and any other URL makes storefront pages throw.
 * So accept an Unsplash photo address with any query and rewrite it to
 * `unsplash(id)`; refuse every other host.
 */
export function readImageUrl(value: string): Read<string> {
  const https = readHttpsUrl(value);
  if (!https.ok) return https;
  const url = new URL(https.value);
  const match = UNSPLASH_PHOTO_PATH.exec(url.pathname);
  if (url.hostname !== "images.unsplash.com" || !match) {
    return {
      ok: false,
      error:
        "Use an Unsplash photo address (https://images.unsplash.com/photo-…). Other hosts can't be shown on the storefront.",
    };
  }
  return { ok: true, value: unsplash(match[1]) };
}
