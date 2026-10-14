# Production checklist

What has to be true before Atelier Store takes real money, and what to run
afterwards. Work through it top to bottom on the first deploy; the
"Every deploy" and "Ongoing" sections apply after that.

## Runtime

- [ ] **Node 22.15 or newer.** `pnpm orders:reconcile` uses
      `module.registerHooks` (Node ≥ 22.15). Development uses Node 24.
- [ ] **pnpm** as the package manager (`packageManager` in `package.json`).

## Environment variables

Set these on the host. Never commit them; `.env.local` is for development only.

| Variable | Production value |
|---|---|
| `DATABASE_URL` | The **production** Neon database, pooled connection string. Not the dev database. |
| `BETTER_AUTH_SECRET` | A new random secret (e.g. `openssl rand -base64 32`). Don't reuse the dev one. Changing it later signs everyone out. |
| `BETTER_AUTH_URL` | The site's public origin, e.g. `https://shop.example.com`. |
| `NEXT_PUBLIC_APP_URL` | Same origin. It is also the base of Stripe's success and cancel URLs, so a wrong value sends paying customers to the wrong site. |
| `STRIPE_SECRET_KEY` | The **live** secret key (`sk_live_…`), or better a restricted key with only the permissions the app uses (Checkout Sessions, PaymentIntents, Charges read, Refunds write). The admin's "View in Stripe" link follows the key's mode. |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the **production webhook endpoint** (below), not the one `stripe listen` prints. |

## Database

- [ ] Run migrations against production **before** building:
      `DATABASE_URL=<prod> pnpm db:migrate`. `pnpm build` queries the
      database (`/` and `generateStaticParams`), so it needs the migrated
      schema.
- [ ] **Never run `pnpm db:seed` against production.** It deletes every
      category, product and image, empties every bag and unlinks order
      lines from their products.
- [ ] Never `pnpm db:push`. Migrations only.
- [ ] Load the real catalogue through `/admin` (categories, then products
      with images; products start as drafts and need an image to go active).
- [ ] Turn on Neon's point-in-time restore / backups for the production
      branch.

## First admin

- [ ] Sign up on the live site with the admin's address.
- [ ] Promote it: `DATABASE_URL=<prod> pnpm db:make-admin <email>`.
- [ ] There is **no password reset** (emails were dropped from the plan). A
      locked-out admin is replaced: sign up a new account and promote it, then
      `pnpm db:make-admin <old email> --revoke`.

## Stripe

- [ ] Activate the Stripe account for live payments.
- [ ] In the Dashboard → Developers → Webhooks, **add an endpoint**:
      `https://<your domain>/api/stripe/webhook`, subscribed to exactly:
      - `checkout.session.completed`
      - `checkout.session.async_payment_succeeded`
      - `checkout.session.async_payment_failed`
      - `charge.refunded`
- [ ] Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] Choose payment methods in the Dashboard (the app deliberately doesn't
      pass `payment_method_types`).
- [ ] Shipping countries are fixed in code (`SHIPPING_COUNTRIES` in
      `src/lib/shipping-address.ts`: US, CA, GB and the EU); shipping is free.
- [ ] Make one real, small purchase and refund it from `/admin/orders` to
      prove the whole path: order written, bag cleared, stock lowered,
      refund recorded.

## Hosting and security

- [ ] HTTPS only.
- [ ] **Client IPs for rate limiting.** Limits are keyed on the client IP
      (Better Auth's `getIP`, `x-forwarded-for` by default). On Vercel this is
      correct out of the box. Behind any other proxy or load balancer, set
      `advanced.ipAddress` in `src/lib/auth.ts` (`ipAddressHeaders` /
      `trustedProxies`) so clients can't spoof their IP; otherwise everyone
      may share one bucket or attackers may dodge it.
- [ ] Rate-limit counters live in the `rate_limit` table (shared by all
      instances). If the database errors, the Server Action limiter fails
      open and logs `console.error`.
- [ ] `/admin` is protected by `requireAdmin` in every page, action and query;
      there is no `proxy.ts`. Keep it that way when adding admin code.

## Every deploy

1. `pnpm typecheck && pnpm lint && pnpm test` (tests use the database in
   `DATABASE_URL`; run them against dev, not production).
2. Apply new migrations to production (`pnpm db:migrate`).
3. `pnpm build` and deploy.
4. Smoke-check `/`, a product page, `/bag`, `/admin`.

## Ongoing

- [ ] **Reconcile daily** (cron or CI schedule) against production:
      `pnpm orders:reconcile --days 2`. Exit code `1` means a paid Checkout
      Session has no order, or Stripe has refunds the database doesn't;
      alert on it. Fix with `pnpm orders:reconcile --days 2 --fix`.
- [ ] Watch the logs for `Oversold at fulfilment` (also recorded as
      `oversell` rows in stock history), `Catalogue revalidation failed`
      and webhook `Handler error` responses.
- [ ] Check the Stripe Dashboard's webhook page for failed deliveries.

## Known limits (accepted for now)

- No emails: no order confirmation, shipping notice or password reset.
- No guest checkout; one shared stock count per product (no per-size stock).
- Changing a product or collection slug breaks the old URL (no redirects).
- The home page's category grid is a fixed list in `src/lib/catalog.ts`.
