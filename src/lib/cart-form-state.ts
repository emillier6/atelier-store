/**
 * What the bag forms pass through useActionState. Outside cart-actions.ts
 * because a "use server" module may only export async functions.
 */
export type CartFormState = {
  error: string | null;
  /** Add to bag only: the piece was added. */
  added?: boolean;
};

export const emptyCartState: CartFormState = { error: null };
