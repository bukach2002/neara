# Launch Readiness Checklist

## Required Commands

Run from the repository root unless noted.

```bash
npm install
npm --workspace apps/api run db:generate
npm --workspace apps/api run build
npm --workspace apps/web run build
npm --workspace apps/api run test
```

Apply migrations:

```bash
cd apps/api
npx dotenv -e ../../.env -- prisma migrate deploy
```

Seed only non-production or approved staging environments:

```bash
npm --workspace apps/api run db:seed
```

## Staging Deployment

1. Provision PostgreSQL with PostGIS and `pg_trgm`.
2. Provision authenticated Redis for BullMQ.
3. Configure all environment variables from `doc/11-environment-reference.md`.
4. Run `prisma migrate deploy`.
5. Deploy API.
6. Deploy web with `NEXT_PUBLIC_API_APP_URL` or API base URL pointing to staging API.
7. Start one notification worker process:

   ```bash
   npm --workspace apps/api run worker
   ```

8. Schedule reminder enqueue command every 15 minutes:

   ```bash
   npm --workspace apps/api run reminders:enqueue
   ```

9. Open `/api/health/dependencies` and confirm database, Redis, email, and storage readiness.
10. Open `/api/docs` and confirm OpenAPI renders.
11. Confirm API responses include `x-request-id` and application logs are valid JSON lines in the runtime log collector.

## Production Deployment

1. Use separate production DB, Redis, S3 bucket, Mailtrap or production email credentials, and Google Maps API key.
2. Set `NODE_ENV=production`.
3. Set long random `SESSION_SECRET` and `CSRF_SECRET`.
4. Set `RATE_LIMIT_REDIS_ENABLED=true` only when Redis auth is valid.
5. Run migrations with a direct database URL that supports DDL.
6. Deploy API and web.
7. Run at least one worker replica.
8. Configure backup/restore using `doc/12-backup-restore-notes.md`.
9. Configure `ERROR_TRACKING_WEBHOOK_URL` if using an external error collector.
10. Set `LOG_LEVEL=info` unless a temporary debugging window needs a more verbose threshold.

## Manual End-to-End Verification

Customer booking flow:

1. Search on `/` with location and radius.
2. Open a tenant detail page.
3. Select service, expert or any expert, date, and slot.
4. Submit booking with consent.
5. Confirm reference format `{PREFIX}-{CODE}`.
6. Look up the booking on `/booking-lookup`.

Admin flow:

1. Log in as platform admin.
2. Create a draft tenant.
3. Create first tenant admin.
4. Log in as tenant admin.
5. Configure location, service, expert, service assignment, and availability.
6. Activate tenant as platform admin.
7. Confirm inactive/suspended tenants are not public.

Notifications:

1. Configure Mailtrap credentials.
2. Configure authenticated Redis URL.
3. Start worker.
4. Create booking with customer email.
5. Confirm notification log moves through queued/sent.
6. Cancel booking as admin and confirm cancellation email.
7. Run reminder enqueue command against a booking starting roughly 24 hours ahead.

Security and privacy:

1. Confirm tenant admin cannot open another tenant workspace.
2. Confirm platform admin can use booking lookup.
3. Confirm anonymization masks PII while retaining operational booking records.
4. Confirm rate limits return `429` after configured limits.
5. Confirm a failed browser API request emits a sanitized `client.event.received` log with the same request ID as the API response.
