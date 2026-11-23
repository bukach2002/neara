# Environment Reference

Use app-specific env files for deployment:

- API: copy `apps/api/.env.example` to `apps/api/.env`
- Web: copy `apps/web/.env.example` to `apps/web/.env`

The root `.env.example` remains a local monorepo convenience template. Do not put server secrets in `apps/web/.env`; only variables prefixed with `NEXT_PUBLIC_` are intended for browser use.

## App

- `NODE_ENV`: `development`, `test`, `staging`, or `production`
- `LOG_LEVEL`: structured operational log threshold, one of `debug`, `log`, `info`, `warn`, or `error`; defaults to `debug` outside staging/production and `info` in staging/production
- `WEB_APP_URL`: frontend origin used for CORS
- `CORS_ALLOWED_ORIGINS`: comma-separated frontend origins allowed by the API, in addition to `WEB_APP_URL`
- `API_APP_URL`: public API origin
- `NEXT_PUBLIC_API_APP_URL`: browser-visible API origin for the web app
- `API_PORT`: local API port

## Data Stores

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string for BullMQ and health checks
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST credentials; when both are set the rate limiter uses the shared store
- `RATE_LIMIT_REQUIRE_SHARED_STORE`: set `true` to fail boot outside production/staging when no shared store is configured; defaults to `false`
- `ALLOW_IN_MEMORY_RATE_LIMIT`: set `true` to boot with per-process in-memory counters even when a shared store is required; defaults to `false`. Only for single-instance deployments or temporary runs without Upstash

## Sessions and CSRF

- `SESSION_SECRET`: long random secret for secure admin sessions
- `CSRF_SECRET`: long random secret for CSRF tokens if stored separately
- `SESSION_COOKIE_NAME`: admin session cookie name

## Email (Resend)

- `RESEND_SMTP_HOST`: Resend SMTP host; defaults to `smtp.resend.com`
- `RESEND_SMTP_PORT`: Resend SMTP port; defaults to `465` (implicit TLS). Port `587` uses STARTTLS.
- `RESEND_API_KEY`: Resend API key, used as the SMTP password; SMTP username is `resend`
- `MAIL_FROM`: sender address on a domain verified with Resend, for example `"Neara <no-reply@your-domain.com>"`

## Google Maps

- `GOOGLE_MAPS_API_KEY`: Places and geocoding key

## S3-Compatible Storage

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- `UPLOAD_MAX_IMAGE_BYTES`

## Rate Limits

All rate limits are read from environment variables with local-development defaults:

- `RATE_LIMIT_PUBLIC_SEARCH_PER_MINUTE`
- `RATE_LIMIT_PUBLIC_SLOT_LOOKUP_PER_MINUTE`
- `RATE_LIMIT_PUBLIC_BOOKING_CREATE_PER_MINUTE`
- `RATE_LIMIT_PUBLIC_BOOKING_LOOKUP_PER_MINUTE`
- `RATE_LIMIT_ADMIN_LOGIN_PER_WINDOW`
- `RATE_LIMIT_PASSWORD_RESET_PER_HOUR`
- `RATE_LIMIT_WINDOW_SECONDS`

In `production` and `staging` the API refuses to start without
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` unless
`ALLOW_IN_MEMORY_RATE_LIMIT=true`. Both values must be the literal `true` or `false`;
validation rejects `1`, `TRUE`, and similar spellings.

## Observability

- `ERROR_TRACKING_WEBHOOK_URL`: optional webhook endpoint for captured 5xx exception events
- Operational logs are structured JSON written to stdout/stderr. API responses include an `x-request-id` header, and browser API helpers send the same header so frontend failures can be correlated with API request logs.

## Web App

The web app currently needs only:

- `NODE_ENV`
- `NEXT_PUBLIC_API_APP_URL`
