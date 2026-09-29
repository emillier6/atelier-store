"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { authHref } from "@/components/auth/auth-shell";
import { signUp } from "@/lib/auth-actions";
import { emptyAuthState, MIN_PASSWORD_LENGTH } from "@/lib/auth-form-state";

/** `next` has been checked by the page; the action checks it again. */
export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, emptyAuthState);

  return (
    <form action={action} className="stack gap-6">
      {state.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
          {state.emailTaken && (
            <>
              {" "}
              <Link href={authHref("/sign-in", next)} className="link">
                Sign in instead
              </Link>
            </>
          )}
        </p>
      )}

      <AuthField
        name="name"
        label="Name"
        autoComplete="name"
        required
        maxLength={80}
        defaultValue={state.name}
      />
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
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={128}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <input type="hidden" name="next" value={next} />

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-block"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
