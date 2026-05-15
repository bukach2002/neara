# Neara

Production-ready MVP foundation for a multi-tenant appointment booking platform.

## Stack

- `apps/web`: Next.js, React, TypeScript
- `apps/api`: NestJS, Prisma, PostgreSQL 16 + PostGIS, Redis/BullMQ-ready
- Database IDs use UUIDs.
- Admin APIs are designed for secure cookie sessions and CSRF-protected web flows.
- Public booking APIs remain anonymous.

## Local Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

   The root `.env` is a local monorepo convenience file. For deployment, use app-specific env vars: API secrets belong to `apps/api`, while the web app should only receive browser-safe values such as `NEXT_PUBLIC_API_APP_URL`.

2. Start PostgreSQL with PostGIS and Redis:

   ```bash
   docker compose up -d
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Generate Prisma client and run migrations:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Start both apps:

   ```bash
   npm run dev
   ```

Default URLs:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/health`
- API dependencies: `http://localhost:4000/api/health/dependencies`
- OpenAPI: `http://localhost:4000/api/docs`

Seeded local users:

- Platform admin: `platform.admin@neara.local` / `ChangeMe123!`
- Tenant admin: `tenant.admin@neara.local` / `ChangeMe123!`

## MVP Surface

Implemented MVP surface includes:

- Monorepo structure
- Next.js frontend shell
- NestJS backend
- Health and dependency endpoints
- OpenAPI generation path
- Prisma schema for required MVP entities
- Local seed data for categories, an active tenant, services, expert, availability, and admins
- Docker Compose for PostgreSQL/PostGIS and Redis
- Environment variable reference
- Admin secure cookie sessions, CSRF protection, login/logout, and password reset
- Platform tenant/category/log/booking management
- Tenant profile, location, logo, service, expert, availability, exception, upload, and booking management
- Public marketplace search, tenant pages, slot lookup, booking creation, and booking lookup
- Email notification queue foundation, cancellation notifications, and reminder enqueue command
- Privacy anonymization endpoint and focused backend regression tests

## Guides

- Engineering setup: `doc/10-engineering-setup.md`
- Environment variables: `doc/11-environment-reference.md`
- Backup/restore: `doc/12-backup-restore-notes.md`
- Admin guide: `doc/13-admin-user-guide.md`
- Tenant quick start: `doc/14-tenant-admin-quick-start.md`

## Guardrails

Do not add MVP-excluded features such as payments, customer accounts, expert login, branch routing, rescheduling, reviews, coupons, waitlists, group classes, or sensitive medical records.
