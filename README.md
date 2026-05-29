# Zoho Sprints Power Grid

Personal-first productivity UI for Zoho Sprints with a lightweight React grid, NestJS BFF, and SQLite cache.

## Workspace

- `apps/web`: Next.js + Tailwind web app
- `apps/api`: NestJS BFF with SQLite + Drizzle
- `packages/shared`: shared types and helpers
- `packages/ui`: reusable UI primitives

## Quick start

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Run `pnpm install`.
3. Run `pnpm migrate`.
4. Run `pnpm seed` for demo data.
5. Run `pnpm dev`.

Useful fallbacks:

- `pnpm dev:api` starts only the API
- `pnpm dev:web` starts only the web app

The app starts in an unconnected state until Zoho OAuth is configured.
