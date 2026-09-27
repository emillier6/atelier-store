// Source images are capped at 2400px; next/image resizes from there.
export const UNSPLASH_SEARCH = "?auto=format&fit=max&w=2400&q=80";

export function unsplash(id: string) {
  return `https://images.unsplash.com/photo-${id}${UNSPLASH_SEARCH}`;
}
