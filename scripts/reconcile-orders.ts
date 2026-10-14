/**
 * Finds, and with --fix repairs, drift between Stripe and the orders table:
 *
 *   1. Paid Checkout Sessions with no orders row (the webhook never ran,
 *      e.g. no `stripe listen` in dev, or the endpoint was down for longer
 *      than Stripe retries).
 *   2. Orders whose charge has more refunded in Stripe than
 *      orders.refunded_cents records (a missed charge.refunded event).
 *
 *   pnpm orders:reconcile                 # dry run, sessions/refunds of the last 7 days
 *   pnpm orders:reconcile --days 30       # wider window (1–90 days)
 *   pnpm orders:reconcile --fix           # write the missing orders and refunds
 *
 * Exit codes (for cron): 0 = no drift (or, with --fix, all of it repaired),
 * 1 = drift found (or, with --fix, some of it still there), 2 = bad
 * arguments or an error.
 *
 * Repairs reuse the webhook's own code: fulfillCheckoutSession (re-reads the
 * session from Stripe, skips unpaid ones, idempotent on the unique
 * stripe_checkout_session_id) and recordChargeRefunded (only ever raises
 * refunded_cents). Running this while the webhook is live is safe.
 *
 * `server-only`: orders.ts, refunds.ts and stripe.ts import it, and its
 * default export throws outside Next's react-server build. Running all of
 * tsx with `--conditions=react-server` doesn't work: it also switches `react`
 * to its server build, which has no createContext, and next/navigation
 * (imported through session.ts) crashes on load. Instead this script
 * registers a Node resolve hook that adds the react-server condition for the
 * `server-only` specifier alone, so it resolves to the package's own empty
 * module, then loads the src modules with dynamic import(). Nothing else
 * changes how it resolves.
 *
 * next/cache's revalidatePath is imported transitively (catalogue-paths.ts)
 * but never called here: it only works inside a Next request. Catalogue
 * pages pick up stock changes within their 60s revalidate.
 */
import * as nodeModule from "node:module";
import { inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../src/db";
import { orders } from "../src/db/schema";

type ResolveHook = (
  specifier: string,
  context: { conditions: string[] },
  nextResolve: (
    specifier: string,
    context: { conditions: string[] },
  ) => unknown,
) => unknown;

function stubServerOnly() {
  // In Node >= 22.15 / 23.5; @types/node here predates it.
  const { registerHooks } = nodeModule as unknown as {
    registerHooks?: (hooks: { resolve: ResolveHook }) => unknown;
  };
  if (!registerHooks) {
    throw new Error("Node's module.registerHooks is required (Node >= 22.15).");
  }
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier !== "server-only") return nextResolve(specifier, context);
      return nextResolve(specifier, {
        ...context,
        conditions: [...context.conditions, "react-server"],
      });
    },
  });
}

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

function parseArgs(argv: string[]) {
  let days = DEFAULT_DAYS;
  let fix = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fix") fix = true;
    else if (arg === "--days" || arg.startsWith("--days=")) {
      const raw = arg === "--days" ? argv[++i] : arg.slice("--days=".length);
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) {
        throw new UsageError(`--days must be a whole number from 1 to ${MAX_DAYS}.`);
      }
      days = n;
    } else throw new UsageError(`Unknown argument: ${arg}`);
  }
  return { days, fix };
}

class UsageError extends Error {}

function money(cents: number | null, currency: string | null) {
  return `${((cents ?? 0) / 100).toFixed(2)} ${(currency ?? "usd").toUpperCase()}`;
}

function when(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().replace(".000Z", "Z");
}

function idOf(ref: string | { id: string } | null | undefined) {
  return typeof ref === "string" ? ref : (ref?.id ?? null);
}

async function main() {
  const { days, fix } = parseArgs(process.argv.slice(2));

  stubServerOnly();
  const { getStripe } = await import("../src/lib/stripe");
  const { fulfillCheckoutSession } = await import("../src/lib/orders");
  const { recordChargeRefunded } = await import("../src/lib/refunds");

  const stripe = getStripe();
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  console.log(
    `Reconciling Stripe and orders for the last ${days} day(s) (since ${when(since)})${fix ? ", fixing" : ", dry run"}.\n`,
  );

  // --- 1. Paid sessions without an order --------------------------------
  const paid: Stripe.Checkout.Session[] = [];
  let ignored = 0;
  for await (const session of stripe.checkout.sessions.list({
    created: { gte: since },
    status: "complete",
    limit: 100,
  })) {
    // fulfillCheckoutSession only skips "unpaid" (delayed payment methods).
    if (session.payment_status === "unpaid") continue;
    // No user: a `stripe trigger` fixture or another integration on the
    // account. fulfillCheckoutSession skips these too.
    if (!session.client_reference_id) {
      ignored++;
      continue;
    }
    paid.push(session);
  }

  const known = paid.length
    ? await db
        .select({ sessionId: orders.stripeCheckoutSessionId })
        .from(orders)
        .where(
          inArray(
            orders.stripeCheckoutSessionId,
            paid.map((s) => s.id),
          ),
        )
    : [];
  const haveOrder = new Set(known.map((row) => row.sessionId));
  const missing = paid.filter((s) => !haveOrder.has(s.id));

  console.log(
    `Checkout Sessions: ${paid.length} paid, ${missing.length} without an order` +
      (ignored ? ` (${ignored} paid without client_reference_id ignored)` : "") +
      ".",
  );
  for (const s of missing) {
    console.log(
      `  ${s.id}  ${when(s.created)}  ${s.customer_details?.email ?? s.customer_email ?? "-"}  ` +
        `${money(s.amount_total, s.currency)}  user=${s.client_reference_id}`,
    );
  }

  // --- 2. Refunds not recorded ------------------------------------------
  // Refunds made in the window, by charge; the charge's amount_refunded is
  // the cumulative total that orders.refunded_cents mirrors.
  const chargeIds = new Set<string>();
  for await (const refund of stripe.refunds.list({
    created: { gte: since },
    limit: 100,
  })) {
    const chargeId = idOf(refund.charge);
    if (chargeId) chargeIds.add(chargeId);
  }
  const charges: Stripe.Charge[] = [];
  for (const id of chargeIds) charges.push(await stripe.charges.retrieve(id));

  const intentIds = charges.flatMap((c) => idOf(c.payment_intent) ?? []);
  const refundRows = intentIds.length
    ? await db
        .select({
          id: orders.id,
          paymentIntentId: orders.stripePaymentIntentId,
          totalCents: orders.totalCents,
          refundedCents: orders.refundedCents,
          currency: orders.currency,
        })
        .from(orders)
        .where(inArray(orders.stripePaymentIntentId, intentIds))
    : [];
  const orderByIntent = new Map(refundRows.map((r) => [r.paymentIntentId, r]));

  const unrecorded = charges.flatMap((charge) => {
    const order = orderByIntent.get(idOf(charge.payment_intent));
    if (!order) return [];
    // recordRefundedAmount caps at the order total, as the CHECK requires.
    const stripeCents = Math.min(charge.amount_refunded, order.totalCents);
    return stripeCents > order.refundedCents
      ? [{ charge, order, stripeCents }]
      : [];
  });

  console.log(
    `\nRefunds: ${chargeIds.size} refunded charge(s), ${refundRows.length} matched to orders, ` +
      `${unrecorded.length} with unrecorded refunds.`,
  );
  for (const { charge, order, stripeCents } of unrecorded) {
    console.log(
      `  order ${order.id}  ${charge.id}  Stripe ${money(stripeCents, order.currency)}  ` +
        `DB ${money(order.refundedCents, order.currency)}`,
    );
  }

  const drift = missing.length + unrecorded.length;
  if (drift === 0) {
    console.log("\nNo drift.");
    return 0;
  }
  if (!fix) {
    console.log(`\n${drift} problem(s) found. Run with --fix to repair them.`);
    return 1;
  }

  // --- Repair -------------------------------------------------------------
  console.log("\nFixing:");
  for (const s of missing) {
    const paths = await fulfillCheckoutSession(s.id);
    console.log(
      paths.length
        ? `  wrote order for ${s.id} (stock changed on ${paths.length} catalogue page(s))`
        : `  ${s.id}: nothing written (already fulfilled meanwhile, or skipped)`,
    );
  }
  for (const { charge, order } of unrecorded) {
    await recordChargeRefunded(charge);
    console.log(
      `  recorded ${money(charge.amount_refunded, order.currency)} refunded on order ${order.id}`,
    );
  }

  // Check the repairs landed rather than trusting the return values.
  const stillMissing = missing.length
    ? missing.length -
      (
        await db
          .select({ id: orders.id })
          .from(orders)
          .where(
            inArray(
              orders.stripeCheckoutSessionId,
              missing.map((s) => s.id),
            ),
          )
      ).length
    : 0;
  if (missing.length) {
    console.log(
      "\nCatalogue pages show the new stock within 60s (revalidatePath can't run outside Next).",
    );
  }
  if (stillMissing > 0) {
    console.log(`${stillMissing} session(s) still have no order; see the log above.`);
    return 1;
  }
  console.log("All drift repaired.");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof UsageError ? error.message : error);
    if (error instanceof UsageError) {
      console.error("Usage: pnpm orders:reconcile [--days N] [--fix]");
    }
    process.exit(2);
  },
);
