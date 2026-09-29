"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { authHref } from "@/components/auth/auth-shell";
import { signIn } from "@/lib/auth-actions";
import { emptyAuthState } from "@/lib/auth-form-state";

/** `next` has been checked by the page; the action checks it again. */
export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, emptyAuthState);

  return (
    <form action={action} className="stack gap-6">
      {state.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error} New here?{" "}
          <Link href={authHref("/sign-up", next)} className="link">
            Create an account
          </Link>
        </p>
      )}

      <AuthField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
      />
      <AuthField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
      />
      <input type="hidden" name="next" value={next} />

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-block"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
