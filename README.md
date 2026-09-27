# Atelier Store

Next.js (App Router) + TypeScript + Tailwind CSS, with Better Auth, Drizzle ORM and Neon Postgres.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL and BETTER_AUTH_SECRET
pnpm auth:generate     # generate Better Auth tables into src/db/schema/auth.ts
                       # then re-export them from src/db/schema/index.ts
pnpm db:push           # or: pnpm db:generate && pnpm db:migrate
pnpm dev
```

## Layout

- `src/db/index.ts` – Drizzle client (Neon HTTP driver)
- `src/db/schema/` – Drizzle schema (empty for now)
- `src/lib/auth.ts` – Better Auth server instance (Drizzle adapter)
- `src/lib/auth-client.ts` – Better Auth React client
- `src/app/api/auth/[...all]/route.ts` – Better Auth route handler
- `drizzle.config.ts` – drizzle-kit config (migrations output to `drizzle/`)

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:push`, `db:studio`, `auth:generate`
