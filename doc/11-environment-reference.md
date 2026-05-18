# Environment Reference

Use app-specific env files for deployment:

- API: copy `apps/api/.env.example` to `apps/api/.env`
- Web: copy `apps/web/.env.example` to `apps/web/.env`

The root `.env.example` remains a local monorepo convenience template. Do not put server secrets in `apps/web/.env`; only variables prefixed with `NEXT_PUBLIC_` are intended for browser use.

## App

- `NODE_ENV`: `development`, `test`, `staging`, or `production`
- `WEB_APP_URL`: frontend origin used for CORS
- `API_APP_URL`: public API origin
- `NEXT_PUBLIC_API_APP_URL`: browser-visible API origin for the web app
- `API_PORT`: local API port

## Data Stores

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string for BullMQ and health checks
- `RATE_LIMIT_REDIS_ENABLED`: set `true` to use Redis-backed distributed rate-limit counters; defaults to `false`

## Sessions and CSRF

- `SESSION_SECRET`: long random secret for secure admin sessions
- `CSRF_SECRET`: long random secret for CSRF tokens if stored separately
- `SESSION_COOKIE_NAME`: admin session cookie name

## Mailtrap

- `MAILTRAP_HOST`
- `MAILTRAP_PORT`
- `MAILTRAP_USERNAME`
- `MAILTRAP_PASSWORD`
- `MAIL_FROM`

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

## Observability

- `ERROR_TRACKING_WEBHOOK_URL`: optional webhook endpoint for captured 5xx exception events

## Web App

The web app currently needs only:

- `NODE_ENV`
- `NEXT_PUBLIC_API_APP_URL`
