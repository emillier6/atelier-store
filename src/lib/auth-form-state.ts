/**
 * What the auth forms pass through useActionState. It lives outside
 * auth-actions.ts because a "use server" module may only export async
 * functions.
 *
 * `name` and `email` echo the submission so the form can refill them after
 * an error; React resets the form once the action returns. The password is
 * never sent back.
 */
export type AuthFormState = {
  error: string | null;
  /** Sign-up only: the address already has an account. */
  emailTaken?: boolean;
  name?: string;
  email?: string;
};

export const emptyAuthState: AuthFormState = { error: null };

/** Better Auth's default minimum, shown as a hint on the sign-up form. */
export const MIN_PASSWORD_LENGTH = 8;
