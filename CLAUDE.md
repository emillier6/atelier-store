# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Atelier Store is an eCommerce app in an early stage. It uses Next.js 16 (App Router, `src/` dir), TypeScript (strict), Tailwind CSS v4, Better Auth, and Drizzle ORM on Neon Postgres. The storefront (home, product pages) reads products, categories and stock from the database; there are no carts, orders or variants yet. The package manager is pnpm; use `pnpm`, not npm or yarn.

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
```

There is no test framework configured yet.

`pnpm build` needs a reachable, migrated and seeded database: `/` and the product pages' `generateStaticParams` query it at build time. Placeholder `DATABASE_URL` values no longer work for builds.

## Architecture

Request flow for auth: `authClient` (`src/lib/auth-client.ts`, React, `baseURL = NEXT_PUBLIC_APP_URL`) → catch-all route `src/app/api/auth/[...all]/route.ts` (`toNextJsHandler(auth)`) → `auth` (`src/lib/auth.ts`) → `drizzleAdapter(db, { provider: "pg", schema })` → `db` (`src/db/index.ts`) → Neon.

- **Single sources of truth:** `src/lib/auth.ts` holds the only Better Auth instance. Server code should call `auth.api.*` directly (e.g. `auth.api.getSession({ headers: await headers() })`) and not fetch `/api/auth`. `src/db/index.ts` holds the only Drizzle client.
- **Schema wiring:** everything lives in one file, `src/db/schema.ts`, read by the runtime `db`, the Better Auth adapter (`drizzleAdapter(db, { schema })`), and drizzle-kit. The Better Auth tables (`user`, `session`, `account`, `verification`) are hand-maintained there, copied from the tutorial; don't run the Better Auth CLI, which would write a separate file.
- **`nextCookies()` must stay the last plugin** in the `betterAuth` config so that auth calls from Server Actions can set cookies.
- **DB driver:** `drizzle-orm/neon-http` runs one HTTP request per query and has no interactive transactions. If transactions are needed, switch to `drizzle-orm/neon-serverless` with a `Pool`.
- **Env loading:** secrets live in `.env.local` (`.env` is an optional fallback). Next loads both for the app. Tools outside Next load them explicitly with `.env.local` taking precedence: `drizzle.config.ts` through `dotenv`, and `db:seed` through `--env-file-if-exists`. Required vars are listed in `.env.example`: `DATABASE_URL` (Neon pooled URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`. Better Auth reads `BETTER_AUTH_*` implicitly.
- **Next 16 conventions:** middleware is now `proxy.ts` (none exists yet, so no routes are protected). Layouts and pages use the generated global types `LayoutProps<"/">` / `PageProps<"/...">`. Check `node_modules/next/dist/docs/` before relying on older Next.js knowledge.
- **Tailwind v4 is CSS-first:** there's no `tailwind.config`. The whole design system lives in `src/app/globals.css`. Raw tokens sit on `:root` and are swapped by `.theme-inverse`; `@theme` maps them to utilities (`bg-ink`, `text-muted`, `border-line`, `px-gutter`, `text-body-sm`, `font-display`, …). Component classes (`btn*`, `link*`, `type-*`, `field`) sit in `@layer components`, and layout primitives (`container-page|narrow|bleed`, `section`, `grid-products`, `span-feature`, `stack`, `cluster`, `scroller-x`, `hairline*`) are `@utility`s. Use these tokens, not raw colors or px values. The style is monochrome, 0 border radius (pill only for icon buttons), and 1px hairlines.
- **Route types:** `LayoutProps`/`PageProps` come from `.next/types`. If `pnpm typecheck` can't find them after `.next` was deleted, run `pnpm dev` or `pnpm build` once to regenerate them.
- **Path alias:** `@/*` → `src/*`.

## Database conventions

- **Follow the tutorial repo:** this app mirrors the video tutorial's code at https://github.com/adrianhajdin/atelier-store. Match its table/column names and file layout: `src/db/` holds only `index.ts` + `schema.ts`, catalog queries are in `src/lib/products.ts`, the seed is `scripts/seed.ts`. Add only the tables and columns the current storefront uses. Deliberate deviations: the extra `products.sizes` column and loading `.env.local`.
- **Migrations only:** edit `src/db/schema.ts`, run `pnpm db:generate`, review the SQL in `./drizzle`, then run `pnpm db:migrate`. Don't use `db:push`, and don't edit a migration that has already been applied.
- **Catalog model:** `categories` 1─< `products` 1─< `product_images`. Stock is `products.stock_quantity`. Images live only in `product_images`, ordered by `position`, and position 0 is the primary image; `(product_id, position)` is unique. A product with no images is skipped by the queries.
- **Columns:** uuid PKs (`defaultRandom()`) for app tables, text PKs for the auth tables. Money is integer cents (`price_cents`), never float or numeric. App tables use `timestamptz` `created_at`. Ordered display-only lists (`details`, `sizes`) are `jsonb` `$type<string[]>()`. Enforce invariants with named `CHECK` constraints. FKs: category `on delete restrict`, images `on delete cascade`.
- **Read path:** pages read through `src/lib/products.ts`, never through `db` directly. Queries return the `Product` type from `src/lib/catalog.ts`, which must stay free of DB imports because client components import its types. Wrap lookups shared by `generateMetadata` and the page in React `cache()`.
- **Relational-query gotcha:** inside `db.query.*`, raw `sql` that interpolates another table's columns is rewritten to the root table's alias. Write such subqueries with literal, aliased names (see `categoryIdBySlug`) and check them with `.toSQL()`. The tutorial's own `getRelatedProducts` has this bug; don't copy it.
- **Freshness:** `cacheComponents` is off, and DB-backed pages use `export const revalidate = 60`. Stock shown on a page can be stale, so check stock in the DB at write time (cart/checkout).
- **Seed:** `pnpm db:seed` deletes all categories, products and images and re-inserts them in one `db.batch()` (a single transaction). It's for dev and the initial load only, never for production data.
