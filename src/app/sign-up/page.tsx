import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, authHref } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getCurrentUser, safeNextPath } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an Atelier account to shop and follow your orders.",
};

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthShell
      title="Create an account"
      intro="You need an account to fill your bag and check out. Your orders stay in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href={authHref("/sign-in", next)} className="link">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthShell>
  );
}
