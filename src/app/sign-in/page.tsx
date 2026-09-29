import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, authHref } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser, safeNextPath } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Atelier account.",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthShell
      title="Sign in"
      intro="Sign in to see your bag, check out and follow your orders."
      footer={
        <>
          No account yet?{" "}
          <Link href={authHref("/sign-up", next)} className="link">
            Create one
          </Link>
        </>
      }
    >
      <SignInForm next={next} />
    </AuthShell>
  );
}
