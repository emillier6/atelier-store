# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Atelier Store is an eCommerce app in an early stage. It uses Next.js 16 (App Router, `src/` dir), TypeScript (strict), Tailwind CSS v4, Better Auth, Drizzle ORM on Neon Postgres, and Stripe Checkout. The storefront (home, collections, new arrivals, product pages) reads products, categories and stock from the database. Customers sign up and sign in with email and password, fill a bag, pay on Stripe's hosted Checkout page, and see their orders on `/account`. Admins (`user.role = 'admin'`) reach `/admin`, which is only a shell so far. There are no variants (sizes are a list on the product, with one shared stock count), no guest checkout, no shipping address collection and no emails yet. The package manager is pnpm; use `pnpm`, not npm or yarn.

## Commands

```bash
pnpm dev             # dev server (Turbopack) on :3000
pnpm build           # production build
pnpm lint            # eslint (flat config, eslint-config-next)
pnpm typecheck       # tsc --noEmit

pnpm db:generate     # drizzle-kit: create SQL migration from schema diff → ./drizzle
pnpm db:migrate      # apply migrations
pnpm db:push         # push schema directly (no migration files; don't use, see Database conventions)
pnpm db:studio       # Drizzle Studio
pnpm db:seed         # wipe and re-insert the catalog (scripts/seed.ts)
pnpm db:make-admin <email> [--revoke]   # grant/revoke admin (the only way to set user.role)

# Forward Stripe events to the local webhook (needs a logged-in Stripe CLI;
# keep it running while testing payments, in its own terminal)
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to localhost:3000/api/stripe/webhook
```

There is no test framework configured yet. Test flows in the browser against `pnpm dev`; pay with Stripe's test card `4242 4242 4242 4242` in the sandbox.

`pnpm build` needs a reachable, migrated and seeded database: `/` and the product and collection pages' `generateStaticParams` query it at build time. Placeholder `DATABASE_URL` values no longer work for builds. Stripe keys are only read when checkout or the webhook runs, so the build doesn't need them.

## Routes

| Route | Access | What it does |
|---|---|---|
| `/`, `/new-arrivals`, `/collections/[slug]`, `/products/[slug]` | public, static + `revalidate = 60` | catalogue |
| `/sign-up`, `/sign-in` | public; signed-in visitors are redirected to `?next=` | auth forms |
| `/bag` | `requireUser` | bag lines, quantity, remove, Check out |
| `/checkout/success?session_id=` | `requireUser` | order confirmation; waits for the webhook if needed |
| `/account` | `requireUser` | name, email, Sign out, order history |
| `/api/auth/[...all]` | Better Auth handler | used by `authClient`; the forms don't call it |
| `/admin` | `requireAdmin` (customers get 404) | admin shell; more sections to come |
| `/api/stripe/webhook` | Stripe signature | writes orders, revalidates the catalogue paths it changed; must never require a session |

## Architecture

- **Single sources of truth:** `src/lib/auth.ts` holds the only Better Auth instance, `src/db/index.ts` the only Drizzle client, and `getStripe()` in `src/lib/stripe.ts` the only Stripe client. Server code calls `auth.api.*` directly and does not fetch `/api/auth`.
- **Auth:** `emailAndPassword` is enabled. Sign-up, sign-in and sign-out are Server Actions in `src/lib/auth-actions.ts` that call `auth.api.signUpEmail` / `signInEmail` / `signOut`; `nextCookies()` writes the session cookie on the action's response. `src/lib/auth-client.ts` (`authClient`, `baseURL = NEXT_PUBLIC_APP_URL`) exists but no UI uses it yet.
- **`nextCookies()` must stay the last plugin** in the `betterAuth` config so that auth calls from Server Actions can set cookies.
- **Session access (`src/lib/session.ts`, `server-only`):** `getCurrentUser()` (React `cache()`, one DB read per request), `requireUser(nextPath)` (redirects to `/sign-in?next=…`) and `safeNextPath()` (only same-origin paths; blocks `//evil.com` and `/\evil.com`). `requireAdmin(nextPath)` does the same, then calls `notFound()` for non-admins. Every protected page and every bag or checkout action calls `requireUser`; every admin page, action and query calls `requireAdmin` itself (the `/admin` layout's call only hides the menu). There is no `proxy.ts`, so nothing else protects routes.
- **Roles:** `user.role` is `'customer'` (default) or `'admin'`, with a named CHECK. Better Auth knows it as an additional field with `input: false`, so sign-up and `/api/auth/update-user` can't set it; keep it that way. It is set only by `pnpm db:make-admin`.
- **Auth error copy:** sign-in shows one message for every failure ("Email or password is incorrect.") so the form can't reveal which emails have accounts. Sign-up does say an email is taken. Direct `auth.api.*` calls skip Better Auth's rate limiter, so the sign-in and sign-up actions throttle themselves through `src/lib/rate-limit.ts` (in memory, per server instance; a shared store is needed for production). Better Auth's own limiter guards `/api/auth/*`.
- **Server Action rules:** a `"use server"` file may only export async functions, so each form's state type and constants live in a sibling file (`auth-form-state.ts`, `cart-form-state.ts`). Actions can be POSTed to directly, so they validate every field and never trust the markup.
- **React form reset gotcha:** React resets a `<form action={…}>` after the action runs. That unticks controlled radios and snaps uncontrolled selects back to their old default. `ProductPurchase` submits manually (`onSubmit` + `startTransition(() => action(formData))`), and the bag's quantity `<select>` is keyed on the saved quantity.
- **Checkout flow:** the Check out button posts an empty form to `startCheckout` (`src/lib/checkout.ts`), which re-reads the bag and stock from the DB, creates a Stripe-hosted Checkout Session and redirects to it. Each Stripe line carries `product_id` and `size` in its product metadata; `client_reference_id` is the user id. Don't pass `payment_method_types` (it disables the Dashboard's payment methods). `integration_identifier` is a fixed label; keep it fixed.
- **Fulfilment happens only in the webhook**, never on the success page. `src/app/api/stripe/webhook/route.ts` verifies the signature over the raw body and calls `fulfillCheckoutSession` (`src/lib/orders.ts`) for `checkout.session.completed` and `async_payment_succeeded`, skipping unpaid sessions. It must be idempotent: the unique `orders.stripe_checkout_session_id` makes repeats a no-op. One `db.batch()` inserts the order and its lines, lowers stock with `greatest(stock - qty, 0)` and deletes only the bought bag lines (matched by product and size), so items added during checkout stay.
- **Success page:** `/checkout/success` reads the order. If the webhook hasn't written it yet, it confirms with Stripe that the session belongs to the user and is paid, then `PendingOrderRefresh` calls `router.refresh()` every 2s for about 30s. Any other session id returns 404.
- **DB driver:** `drizzle-orm/neon-http` runs one HTTP request per query and has no interactive transactions. Use `db.batch()` (one transaction) with ids generated up front, as the seed and `fulfillCheckoutSession` do. If interactive transactions are needed, switch to `drizzle-orm/neon-serverless` with a `Pool`.
- **Env loading:** secrets live in `.env.local` (`.env` is an optional fallback). Next loads both for the app. Tools outside Next load them explicitly with `.env.local` taking precedence: `drizzle.config.ts` through `dotenv`, and `db:seed` through `--env-file-if-exists`. Required vars are listed in `.env.example`: `DATABASE_URL` (Neon pooled URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` (also the base of Stripe's return URLs), `STRIPE_SECRET_KEY` (test mode) and `STRIPE_WEBHOOK_SECRET` (printed by `stripe listen`). Better Auth reads `BETTER_AUTH_*` implicitly.
- **Next 16 conventions:** middleware is now `proxy.ts` (none exists). Layouts and pages use the generated global types `LayoutProps<"/">` / `PageProps<"/...">`. Check `node_modules/next/dist/docs/` before relying on older Next.js knowledge.
- **Tailwind v4 is CSS-first:** there's no `tailwind.config`. The whole design system lives in `src/app/globals.css`. Raw tokens sit on `:root` and are swapped by `.theme-inverse`; `@theme` maps them to utilities (`bg-ink`, `text-muted`, `border-line`, `px-gutter`, `text-body-sm`, `font-display`, …). Component classes (`btn*`, `link*`, `type-*`, `field`) sit in `@layer components`, and layout primitives (`container-page|narrow|bleed`, `section`, `grid-products`, `span-feature`, `stack`, `cluster`, `scroller-x`, `hairline*`) are `@utility`s. Use these tokens, not raw colors or px values. The style is monochrome, 0 border radius (pill only for icon buttons), and 1px hairlines.
- **Shared page pieces:** `ListingHeader` (breadcrumb, title, piece count) is used by listings and `/bag`; `ProductGrid` by listings; `AuthShell` and `AuthField` by the auth pages; `OrderLines` and `orderNumber()` by `/checkout/success` and `/account`. The auth, success and account pages use one centred column under a `type-display` title.
- **Route types:** `LayoutProps`/`PageProps` come from `.next/types`. If `pnpm typecheck` can't find them after `.next` was deleted or a route was added, run `pnpm dev` or `pnpm build` once to regenerate them.
- **Path alias:** `@/*` → `src/*`.

## Database conventions

- **Follow the tutorial repo:** this app mirrors the video tutorial's code at https://github.com/adrianhajdin/atelier-store. Match its table/column names and file layout: `src/db/` holds only `index.ts` + `schema.ts`; queries live in `src/lib/products.ts` (catalogue), `src/lib/cart.ts` (bag) and `src/lib/orders.ts` (orders); the seed is `scripts/seed.ts`. Add only the tables and columns the current storefront uses. Deliberate deviations: the extra `products.sizes` column, `size` on `cart_items` and `order_items`, removing only the bought bag lines at fulfilment (the tutorial empties the bag), `user.role`, `products.status` and `products.updated_at`, the `stock_adjustments` table, and loading `.env.local`.
- **Migrations only:** edit `src/db/schema.ts`, run `pnpm db:generate`, review the SQL in `./drizzle`, then run `pnpm db:migrate`. Don't use `db:push`, and don't edit a migration that has already been applied. Ask the user before creating new tables. Applied so far: `0000` (auth + catalogue), `0001` (`carts`, `cart_items`), `0002` (`orders`, `order_items`), `0003` (`user.role`, `products.status` + `updated_at`, `stock_adjustments`, `categories_position_check`).
- **Catalog model:** `categories` 1─< `products` 1─< `product_images`. Stock is `products.stock_quantity`, shared by every size. Images live only in `product_images`, ordered by `position`, and position 0 is the primary image; `(product_id, position)` is unique. A product with no images is skipped by the catalogue queries.
- **Bag model:** `user` 1─1 `carts` (unique `user_id`, created on first add with insert-on-conflict-do-nothing) 1─< `cart_items`. A line is unique on `(cart_id, product_id, size)` with `NULLS NOT DISTINCT`, so one-size pieces (`size` null) merge too, and it is the `onConflictDoUpdate` target for Add to bag. There is no price column: prices are read live from `products`. Availability is checked per product across all sizes (`BagLine.unavailable`), and line writes are scoped to the caller's cart.
- **Orders model:** `user` 1─< `orders` 1─< `order_items`. `orders.user_id` is `on delete restrict` (orders are financial records, so delete a user's orders before the user). `total_cents` and `line_total_cents` are what Stripe charged, never recomputed. `order_items` is a snapshot (slug, name, sku, colour, size, image URL, prices) and its `product_id` is `on delete set null`.
- **Product status and stock history:** `products.status` is `draft | active | archived` (default `active`); archive instead of deleting. The storefront, bag and checkout don't filter on it yet; they must before the admin can archive. `stock_adjustments` (product, signed `delta`, `stock_after`, `reason` restock/correction/sale/refund/oversell, optional `user_id` and `order_id`) is meant to be written in the same `db.batch()` as each stock change; nothing writes it yet, and fulfilment still only logs oversells.
- **Columns:** uuid PKs (`defaultRandom()`) for app tables, text PKs for the auth tables. Money is integer cents (`price_cents`, `total_cents`), never float or numeric. App tables use `timestamptz` `created_at`. Ordered display-only lists (`details`, `sizes`) are `jsonb` `$type<string[]>()`. Enforce invariants with named `CHECK` constraints. FKs: category `on delete restrict`, images and bag lines `on delete cascade`.
- **Read path:** pages read through the query modules above, never through `db` directly. Catalogue queries return the `Product` type from `src/lib/catalog.ts`, and bag types live in `src/lib/cart-types.ts`; both must stay free of DB imports because client components import them. `cart.ts`, `orders.ts`, `session.ts` and `stripe.ts` are `server-only`. Wrap lookups shared by `generateMetadata` and the page in React `cache()`.
- **Relational-query gotcha:** inside `db.query.*`, raw `sql` that interpolates another table's columns is rewritten to the root table's alias. Write such subqueries with literal, aliased names (see `categoryIdBySlug`, and the `carts c` subqueries in `cart.ts` and `orders.ts`) and check them with `.toSQL()`. The tutorial's own `getRelatedProducts` has this bug; don't copy it.
- **Freshness:** `cacheComponents` is off. Catalogue pages use `export const revalidate = 60`, so stock shown there can be stale; the pages that read the session are dynamic. Stock is checked again at write time: Add to bag caps a line at the stock (max 10), `startCheckout` refuses unavailable lines, and fulfilment floors stock at 0.
- **Seed:** `pnpm db:seed` deletes all categories, products and images and re-inserts them in one `db.batch()` (a single transaction). Deleting products also empties every bag (`cart_items` cascade) and unlinks order lines (`order_items.product_id` set null; the snapshots stay). It's for dev and the initial load only, never for production data.
