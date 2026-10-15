# Atelier Store

A luxury-fashion eCommerce store: a monochrome editorial storefront, customer
accounts with a shopping bag, payment on Stripe's hosted Checkout, and an
admin for the catalogue, stock and orders.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Better Auth,
Drizzle ORM on Neon Postgres, and Stripe. It follows the structure of
[adrianhajdin/atelier-store](https://github.com/adrianhajdin/atelier-store),
with the deviations listed in [`CLAUDE.md`](CLAUDE.md).

## Features

**Storefront**

- Home page with hero, new arrivals, a ready-to-wear rail, a category grid
  and the craft story.
- Collections per category, New Arrivals, product pages (gallery, sizes,
  stock status, related pieces) and search by name, colour, SKU or category.
- Editorial edits (`/edits/…`) that show live pieces from chosen categories,
  and long-form stories (`/stories/…`).
- Information pages linked from the footer: contact, shipping, returns,
  appointments, personalization, about, sustainability, careers, newsletter,
  terms, privacy and cookies. Copy that is still a stand-in is marked with a
  visible **Placeholder** tag.
- The header menu and the category grid are built from the categories in the
  database, so they follow edits made in the admin.

**Customers**

- Sign up and sign in with email and password (rate-limited).
- A bag with sizes and quantities, checked against live stock.
- Checkout on Stripe with a shipping address (US, Canada, UK and the EU;
  shipping is free).
- An order confirmation page and an order history on `/account`, with
  shipping status, tracking and refunds.

**Admin (`/admin`, admins only)**

- Categories: create, edit, reorder, delete (refused while they have
  products).
- Products: drafts, active and archived; Unsplash images; sizes; filters and
  pagination; a stock panel with history (restock, correction, sale, oversell).
- Orders: search and filter, shipping address, fulfilment (ship with tracking,
  deliver, cancel) and full or partial refunds through Stripe.

**Not built yet:** emails (no order confirmation or password reset), guest
checkout, per-size stock and redirects for changed slugs.

## Requirements

- Node.js 22.15 or newer (development uses Node 24).
- pnpm 11 (pinned in `packageManager`; `corepack enable` installs it).
- A [Neon](https://neon.tech) Postgres database.
- A [Stripe](https://stripe.com) account in test mode and the
  [Stripe CLI](https://docs.stripe.com/stripe-cli).

## Getting started

```bash
pnpm install
cp .env.example .env.local     # then fill in the values below
pnpm db:migrate                # create the tables
pnpm db:seed                   # load the sample catalogue (5 categories, 13 pieces)
pnpm dev                       # http://localhost:3000
```

In a second terminal, forward Stripe events to the local webhook and keep it
running while you test payments:

```bash
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,charge.refunded --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_…` secret it prints into `STRIPE_WEBHOOK_SECRET` and restart
`pnpm dev`. Pay with the test card `4242 4242 4242 4242`, any future date and
any CVC.

To use the admin, sign up on the site, then promote the account:

```bash
pnpm db:make-admin you@example.com
```

### Environment variables

Secrets live in `.env.local` (git-ignored). `.env.example` lists them all.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string. |
| `BETTER_AUTH_SECRET` | A random secret, e.g. `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | The site's origin, `http://localhost:3000` in development. |
| `NEXT_PUBLIC_APP_URL` | Same origin; also the base of Stripe's return URLs. |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret or restricted key. |
| `STRIPE_WEBHOOK_SECRET` | The secret printed by `stripe listen`. |

Scripts outside Next (`drizzle-kit`, the `scripts/` tools) read `.env.local`
too, but a variable already set in your shell wins. That is how they are
pointed at another database:
`DATABASE_URL="…" pnpm db:migrate`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server (Turbopack) on port 3000. |
| `pnpm build` / `pnpm start` | Production build and server. The build queries the database, so it needs one that is reachable and migrated. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` / `pnpm test:watch` | Vitest. |
| `pnpm db:generate` | Create a SQL migration in `drizzle/` from changes to `src/db/schema.ts`. |
| `pnpm db:migrate` | Apply pending migrations. |
| `pnpm db:studio` | Drizzle Studio. |
| `pnpm db:seed` | **Delete** the whole catalogue and re-insert the sample one. Development, or an empty database before launch, only. |
| `pnpm db:make-admin <email> [--revoke]` | Grant or revoke the admin role; the only way to set it. |
| `pnpm orders:reconcile [--days N] [--fix]` | Compare Stripe with the orders table: paid sessions without an order and unrecorded refunds. Exits 1 on drift; `--fix` repairs it. |

Schema changes go through migrations only: edit `src/db/schema.ts`, run
`pnpm db:generate`, review the SQL, then `pnpm db:migrate`. Don't use
`pnpm db:push`.

## Testing

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Pure tests sit next to their module (`*.test.ts`). Database tests run against
the database in `.env.local` and clean up only the `vitest-…` rows they create,
so point it at a development database, never production. Stripe is mocked in
tests. Payment flows are checked by hand in the browser with `stripe listen`
running.

## Project layout

```
src/
  app/                  routes (storefront, account, bag, checkout, admin, API)
    api/auth/[...all]/  Better Auth handler
    api/stripe/webhook/ Stripe events: writes orders, records refunds
  components/           UI: header/footer, product, bag, orders, home, admin
  db/                   Drizzle client (index.ts) and schema (schema.ts)
  lib/                  server logic: auth, session, products, cart, checkout,
                        orders, refunds, admin queries and actions; editorial
                        copy (catalog.ts, content-pages.ts)
scripts/                seed, make-admin, reconcile-orders
drizzle/                SQL migrations
docs/production.md      production checklist
test/                   Vitest fixtures
```

Design tokens and component classes live in `src/app/globals.css` (Tailwind
v4 has no config file). Architecture, conventions and the reasons behind them
are in [`CLAUDE.md`](CLAUDE.md).

## Deploying

The app is meant for Vercel with a production Neon database and a live Stripe
webhook endpoint. Work through [`docs/production.md`](docs/production.md)
before taking real payments. In short:

1. Set the environment variables on the host, with production values: a new
   `BETTER_AUTH_SECRET`, the public origin, a restricted live Stripe key and
   the live webhook's signing secret.
2. Run `pnpm db:migrate` against the production database before the first
   build.
3. Add a Stripe webhook endpoint at `https://<domain>/api/stripe/webhook` for
   the four events listed above.
4. Deploy, sign up, and promote the first admin with `pnpm db:make-admin`.
5. Make a small real purchase and refund it from `/admin/orders`.
6. Run `pnpm orders:reconcile --days 2` daily and alert on exit code 1.

Before taking real orders, replace the placeholder copy, above all the terms
of sale and the privacy policy.
