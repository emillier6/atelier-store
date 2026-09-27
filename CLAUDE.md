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
pnpm db:seed         # upsert the initial catalog (src/db/seed-data.ts); resets stock

pnpm auth:generate   # Better Auth CLI: write auth tables to src/db/schema/auth.ts
```

There is no test framework configured yet.

`pnpm build` needs a reachable, migrated and seeded database: `/` and the product pages' `generateStaticParams` query it at build time. Placeholder `DATABASE_URL` values no longer work for builds.

## Architecture

Request flow for auth: `authClient` (`src/lib/auth-client.ts`, React, `baseURL = NEXT_PUBLIC_APP_URL`) → catch-all route `src/app/api/auth/[...all]/route.ts` (`toNextJsHandler(auth)`) → `auth` (`src/lib/auth.ts`) → `drizzleAdapter(db, { provider: "pg", schema })` → `db` (`src/db/index.ts`) → Neon.

- **Single sources of truth:** `src/lib/auth.ts` holds the only Better Auth instance. Server code should call `auth.api.*` directly (e.g. `auth.api.getSession({ headers: await headers() })`) and not fetch `/api/auth`. `src/db/index.ts` holds the only Drizzle client.
- **Schema wiring:** `src/db/schema/index.ts` is the barrel read by the runtime `db`, the Better Auth adapter, and drizzle-kit (`drizzle.config.ts` points at the `src/db/schema` directory). New table files must be re-exported from `index.ts` or the auth adapter and relational queries won't see them. It currently exports only `./catalog`, so `/api/auth/*` fails at runtime until you run `pnpm auth:generate`, add `export * from "./auth"`, and generate + apply a migration.
- **`nextCookies()` must stay the last plugin** in the `betterAuth` config so that auth calls from Server Actions can set cookies.
- **DB driver:** `drizzle-orm/neon-http` runs one HTTP request per query and has no interactive transactions. If transactions are needed, switch to `drizzle-orm/neon-serverless` with a `Pool`.
- **Env loading:** secrets live in `.env.local` (`.env` is an optional fallback). Next loads both for the app. Tools outside Next load them explicitly with `.env.local` taking precedence: `drizzle.config.ts` through `dotenv`, and `db:seed` through `--env-file-if-exists`. Required vars are listed in `.env.example`: `DATABASE_URL` (Neon pooled URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`. Better Auth reads `BETTER_AUTH_*` implicitly.
- **Next 16 conventions:** middleware is now `proxy.ts` (none exists yet, so no routes are protected). Layouts and pages use the generated global types `LayoutProps<"/">` / `PageProps<"/...">`. Check `node_modules/next/dist/docs/` before relying on older Next.js knowledge.
- **Tailwind v4 is CSS-first:** there's no `tailwind.config`. The whole design system lives in `src/app/globals.css`. Raw tokens sit on `:root` and are swapped by `.theme-inverse`; `@theme` maps them to utilities (`bg-ink`, `text-muted`, `border-line`, `px-gutter`, `text-body-sm`, `font-display`, …). Component classes (`btn*`, `link*`, `type-*`, `field`) sit in `@layer components`, and layout primitives (`container-page|narrow|bleed`, `section`, `grid-products`, `span-feature`, `stack`, `cluster`, `scroller-x`, `hairline*`) are `@utility`s. Use these tokens, not raw colors or px values. The style is monochrome, 0 border radius (pill only for icon buttons), and 1px hairlines.
- **Route types:** `LayoutProps`/`PageProps` come from `.next/types`. If `pnpm typecheck` can't find them after `.next` was deleted, run `pnpm dev` or `pnpm build` once to regenerate them.
- **Path alias:** `@/*` → `src/*`.

## Database conventions

- **Migrations only:** edit `src/db/schema/*`, run `pnpm db:generate`, review the SQL in `./drizzle`, then run `pnpm db:migrate`. Don't use `db:push`, and don't edit a migration that has already been applied.
- **Catalog model:** `categories` 1─< `products` 1─1 `product_stock` (`src/db/schema/catalog.ts`). Stock lives only in `product_stock`, never as a column on `products`. A missing stock row means 0. Variants, when added, attach to `product_stock` and leave `products` alone.
- **Columns:** integer identity PKs. Money is integer cents (`price_cents`), never float or numeric. Use `timestamptz` `created_at`/`updated_at` (`$onUpdate`). Ordered lists that are never queried on their own go in `text[]` or `jsonb`, not child tables; in `images`, the first item is the primary image. Enforce invariants with named `CHECK` constraints.
- **Hide, don't delete:** products are hidden with `active = false`, and every storefront query filters on `active = true`. The category FK is `on delete restrict`.
- **Read path:** pages read through `src/db/queries/catalog.ts`, never through `db` directly. Queries return the `Product` type from `src/lib/catalog.ts`, which must stay free of DB imports because client components import its types. Wrap lookups shared by `generateMetadata` and the page in React `cache()`.
- **Relational-query gotcha:** inside `db.query.*`, raw `sql` that interpolates another table's columns is rewritten to the root table's alias. Write such subqueries with literal, aliased names (see `categoryIdBySlug`) and check them with `.toSQL()`.
- **Freshness:** `cacheComponents` is off, and DB-backed pages use `export const revalidate = 60`. Stock shown on a page can be stale, so check stock in the DB at write time (cart/checkout).
- **Seed:** `pnpm db:seed` upserts by slug and resets stock. It's for dev and the initial load only, never for production data.
