/**
 * Grants or revokes the admin role for an existing account. This is the only
 * way to set user.role: Better Auth won't take it as input, and no route
 * changes it. The account must sign up through the site first.
 *
 *   pnpm db:make-admin you@example.com
 *   pnpm db:make-admin you@example.com --revoke
 *
 * Takes effect on the account's next request: sessions are read from the
 * database every time, with no cookie cache.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();
  if (!email) {
    console.error("Usage: pnpm db:make-admin <email> [--revoke]");
    process.exit(1);
  }

  const role = revoke ? "customer" : "admin";
  const [updated] = await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.email, email))
    .returning({ email: user.email, role: user.role });

  if (!updated) {
    console.error(`No account with the email ${email}. Sign up first.`);
    process.exit(1);
  }
  console.log(`${updated.email} is now ${updated.role}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
