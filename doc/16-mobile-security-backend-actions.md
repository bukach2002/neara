# Neara Mobile — Security Findings and Backend Actions

Status: handoff for the backend coding agent
Scope: security review performed while building `apps/mobile` (Expo, Android + iOS)
Date: 2026-11-05

The mobile app is designed so that **all authorization is enforced by the API**. Client route
guards only decide which interface to show. This document lists the API gaps found while
integrating that client, ordered by risk, with file/line evidence and the change required on the
backend.

Findings are grouped as:

- **P0** — exploitable now, blocks production release
- **P1** — material risk, fix before public launch
- **P2** — hardening / data minimisation

The mobile client already works around some findings (noted under *Client mitigation*), but
workarounds do not remove the server-side requirement.

---

## Executive summary

| ID | Severity | Finding |
| --- | --- | --- |
| M-01 | P0 | Public tenant detail and slot responses over-fetch private expert fields (phone, email, internal metadata) and internal tenant fields |
| M-02 | P0 | Rate-limit key trusts client-supplied `X-Forwarded-For`, bypassing every limiter including login, OTP, and booking lookup |
| M-03 | P0 | OTP confirmation can be brute-forced: wrong codes never increment `attempts`, and OTPs use `Math.random` |
| M-04 | P0 | No mobile-grade auth contract: cookie sessions with no rotation/revocation/device binding; admin login mints an admin session for any active user |
| M-05 | P0 | Customer cookie mutations have no CSRF/Origin enforcement |
| M-06 | P0 | Booking lookup exposes customer PII and is guessable/brute-forceable |
| M-07 | P0 | Customer login has no failed-attempt tracking, and email/phone ownership is never verified |
| M-08 | P1 | No MFA or step-up authentication for platform/tenant admin actions |
| M-09 | P1 | Session lifecycle gaps: 30-day admin / 365-day trusted sessions, no idle timeout, no revocation UI, no rotation |
| M-10 | P1 | Account enumeration through register/tenant-signup and the distinct "locked" login response |
| M-11 | P1 | Tenant isolation is enforced only by route wrappers, not by service-layer scoping |
| M-12 | P1 | In-memory rate limiter fallback and optional shared store allow bypass in multi-instance/serverless deployments |
| M-13 | P1 | Upload pipeline buffers unbounded files because Multer has no `limits` |
| M-14 | P1 | Account deletion does not erase booking snapshots, notification payloads, or audit PII |
| M-15 | P2 | Booking references are only 4 characters from a 32-symbol alphabet and generated with `Math.random` |
| M-16 | P2 | Cookie/session hardening and response caching headers are incomplete |
| M-17 | P2 | Platform endpoints return raw customer/expert records; audit snapshots retain PII |
| M-18 | P2 | No HSTS / security headers on the API, and no certificate-pinning story for native apps |

---

## P0 findings

### M-01 — Public endpoints leak private expert and internal tenant fields

**Evidence**

- `apps/api/src/modules/public/public.service.ts:126-160` returns the full Prisma tenant with
  `experts: { include: { expertServices: ... } }`. `Expert` carries `phone`, `email`, and
  `internalMetadata` (`apps/api/prisma/schema.prisma:263-286`). The response therefore includes
  expert contact details and internal notes.
- The same response includes internal tenant scalars: `bookingPrefix`, `archivedAt`,
  `activatedAt`, `createdAt`, `updatedAt`.
- `apps/api/src/modules/scheduling/scheduling.service.ts:39-55` loads experts without a `select`,
  and each candidate slot returns the whole expert object at lines ~159-166. `/available-slots`
  therefore also returns expert phone/email/internal metadata to any signed-in customer.
- The list endpoints (`listTenantServices`, `listTenantExperts`) already project safe fields. The
  detail and slot endpoints should do the same.

**Impact**

Unauthenticated (tenant detail) or any-customer (slots) disclosure of staff personal contact
details and internal metadata. Public `bookingPrefix` also makes booking references easier to
target.

**Required change**

Replace `include`-everything with explicit `select` projections for every public response:

- tenant: `id, name, slug, description, logoUrl, timezone, primaryCategory {name, slug}, locations
  (public address fields)`
- expert: `id, displayName, shortBio, photoUrl`
- service: `id, name, slug, description, durationMinutes, displayPriceAmount,
  displayPriceCurrency`
- slots: `startsAt, endsAt, displayTime, expert {id, displayName, photoUrl, shortBio}`
- Never return `bookingPrefix`, `archivedAt`, `activatedAt`, `createdAt/updatedAt`, expert `phone`,
  `email`, or `internalMetadata` from public routes.

**Acceptance test**

Snapshot/contract test asserting the JSON keys of `GET /api/public/tenants/:slug` and
`GET /api/public/tenants/:slug/available-slots` contain no `phone`, `email`,
`internalMetadata`, `bookingPrefix`, `archivedAt`, `activatedAt`, `createdAt`, or `updatedAt`.

---

### M-02 — Rate limits are bypassable by spoofing `X-Forwarded-For`

**Evidence**

```ts
// apps/api/src/app.ts:146-149
function clientKey(request: Request) {
  const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.ip || request.socket.remoteAddress || 'unknown';
}
```

`app.set('trust proxy', 1)` is set at `apps/api/src/app.ts:310`, but `clientKey` reads the raw
header and takes the left-most value. With one proxy in front, that value is exactly what the
client sent.

**Impact**

Every limiter keyed by this function can be bypassed by rotating the header: admin/customer
login, OTP request/confirm, password reset, booking creation, booking lookup, search, tenant
signup. This turns M-03/M-06/M-07 from "slow down" to "no limit".

**Required change**

- Derive the client key from Express's parsed address (`request.ip`) after setting `trust proxy`
  to the exact number of trusted proxies, or from an edge-injected header that the origin strips
  from client traffic.
- Add a second limiter keyed by the authenticated principal (user id, tenant id) and by the
  targeted account identifier (email/phone hash) for auth and lookup endpoints.
- Enforce limits at the edge/WAF as well.
- Return `Retry-After` on 429, and fail closed if the shared limiter is unavailable in production.

**Acceptance test**

Integration test sends `X-Forwarded-For: 203.0.113.9`, then `198.51.100.4`, etc., to
`POST /api/admin/auth/login` from one socket and asserts the limiter still triggers.

---

### M-03 — OTP brute force is not actually limited

**Evidence**

- `apps/api/src/modules/auth/customer-auth.service.ts:209-237`: `verifyOtp` computes the expected
  hash and looks up a matching token row. A wrong OTP finds no row and throws before
  `attempts` is ever incremented. `MAX_OTP_ATTEMPTS` therefore never takes effect.
- `apps/api/src/modules/auth/customer-auth.service.ts:296-298`: OTPs are generated with
  `Math.random()`, which is not a CSPRNG.
- The only throttle is `CUSTOMER_OTP_CONFIRM` per-IP (bypassable via M-02).
- OTP lookup uses strict string hashing rather than a constant-time comparison.

**Impact**

A 6-digit code valid for 10 minutes can be enumerated. Both customer login (`purpose=login`)
and password reset (`purpose=password_reset`) are exposed, so this is account takeover.

**Required change**

- Increment a per-user/per-purpose attempt counter on **every** confirmation attempt, regardless
  of match, before returning. Lock the purpose after 5 attempts and invalidate outstanding codes.
- Generate OTPs with `crypto.randomInt(0, 1_000_000)` (zero-padded) and store only a keyed hash.
- Rate limit by account identifier and by IP; exponentially back off repeated failures.
- Use `crypto.timingSafeEqual` for comparison paths.
- Notify the account by email when OTP attempts are exhausted or a reset succeeds.
- Cap active OTP rows per user/purpose (e.g. 3) and invalidate older codes when a new one is
  issued.

**Acceptance test**

Five wrong confirmations against one identifier return 401/429 and invalidate the code; the
sixth attempt with the correct code fails. A test also asserts the generator is not
`Math.random` (inject a CSPRNG or assert via code review).

---

### M-04 — No mobile-grade authentication contract; admin login accepts any active user

**Evidence**

- `apps/api/src/modules/auth/auth.service.ts:28-72`: `POST /admin/auth/login` verifies only
  `status === active` and the password, then creates `SessionAudience.admin`. Any customer
  account can obtain an admin-audience session. Role checks later block admin data, but the
  client is left holding a session with no role.
- Both login endpoints set 30-day httpOnly cookies (`auth.service.ts:16,51`; trusted customer
  sessions are 365 days at `customer-auth.service.ts:18,255`).
- The admin login response returns the CSRF token in the JSON body
  (`auth.service.ts:63-70`) because the web client needs it. Native clients have no secure,
  designed way to consume it.
- No refresh, rotation, device binding, device/session listing, or revocation endpoint exists.
  `Session` stores only `userId, tokenHash, audience, trustedDevice, expiresAt`
  (`apps/api/prisma/schema.prisma:119-132`).
- Sessions are not bound to the client type. Cookie replay from a native app is the only
  supported model, and it relies on the client retaining `Set-Cookie`.

**Impact**

- Cookie theft yields 30–365 days of access with no way to revoke a single device.
- No way to step up authentication, detect concurrent device use, or rotate credentials after a
  compromise.
- The customer mobile app must try two endpoints per sign-in (a password verification at the
  customer endpoint, then a possible second submission at the admin endpoint), doubling
  credential exposure and confusing lockout accounting.

**Required change — mobile auth API**

Add a dedicated, versioned mobile auth surface and keep cookie sessions for the web:

```
POST /api/mobile/auth/login      { identifier, password, device: { id, name, platform } }
  -> 200 { role: "customer" | "tenant_admin" | "platform_admin",
           user, memberships, tenants,
           accessToken, accessTokenExpiresAt,
           refreshToken, refreshTokenExpiresAt }
  -> 401 generic for bad credentials
  -> 403 generic for disabled/no-workspace accounts (no role disclosure in the message)

POST /api/mobile/auth/refresh    { refreshToken, deviceId } -> rotated refresh + new access
POST /api/mobile/auth/logout     { refreshToken } -> revoke current refresh family
POST /api/mobile/auth/logout-all -> revoke every session for the user
GET  /api/mobile/auth/sessions   -> list active devices (id, name, platform, lastUsedAt, createdAt)
DELETE /api/mobile/auth/sessions/:id -> revoke one device
```

Rules:

- Resolve role server-side after **one** password verification. Reject users with no platform
  role and no tenant membership (`403`), instead of minting an unusable admin session.
- Access token: 10–15 minutes, audience-scoped (`customer`, `tenant`, `platform`), bound to
  `deviceId`, signed asymmetrically (EdDSA/RS256) or stored as a random token hash.
- Refresh token: rotated on every use, one-time, hashed at rest, expiry 30 days (90 max), revoked
  with the whole family on reuse detection. Store `deviceId`, user agent/device name,
  `lastUsedAt`, `createdAt`, `revokedAt`.
- Revoke all sessions on password reset, email change, role/membership change, tenant suspension,
  and customer anonymization.
- Never return CSRF material or cookie values to native clients; native uses `Authorization:
  Bearer`. Cookie auth should be rejected on `/api/mobile/*`.
- Add `Cache-Control: no-store` to all auth responses.
- Support `POST /api/mobile/auth/password-reset/{request,confirm}` so admins are not forced to a
  web-only reset flow.

Client migration note: `apps/mobile/src/api/auth.ts` currently implements the two-endpoint
workaround. Once this endpoint exists, replace `signIn`, `restoreSession`, and `logoutRemote` with
the token contract and store the tokens in `expo-secure-store` (the storage abstraction already
exists).

---

### M-05 — Customer mutations accept cookie auth with no CSRF or Origin check

**Evidence**

- `apps/api/src/app.ts:388-390` mounts `POST /public/auth/logout` and `DELETE /public/auth/me`
  without any CSRF verification.
- `apps/api/src/app.ts:420` mounts booking creation without CSRF verification.
- `AuthService.requireCustomerContext` (`auth.service.ts:223-250`) checks only the cookie and
  session. `CsrfService.verifyRequest` is only used by admin context
  (`auth.service.ts:166-183`).
- Cookie attributes are `sameSite: 'lax'` (`auth.service.ts:317-321`), which is a browser
  mitigation, not an API guarantee. Native requests replay cookies directly and have no
  `Origin`/`SameSite` enforcement.

**Impact**

Any environment that accepts cookie-authenticated customer mutations is open to cross-site
booking creation, logout, and account deletion attempts. A stolen cookie can be replayed with no
proof of client intent. Even for the web app, relying on SameSite alone is fragile.

**Required change**

- Require a CSRF token (double-submit + HMAC, as already implemented) for **all** cookie-auth
  mutations, including customer routes and both logout endpoints; verify before any state change.
- Reject cookie-authenticated mutations when `Origin` is present and not allow-listed, and when
  `Sec-Fetch-Site` is `cross-site`. Reject requests that omit both signals for cookie auth where
  possible.
- Prefer the M-04 bearer-token surface for native clients and reject cookie auth on it.
- Make logout idempotent but CSRF-protected.

**Acceptance test**

Cookie-only POST to booking creation without `x-csrf-token` returns 403. Same request with a token
issued for a different session returns 403. Bearer-auth request without cookies succeeds on the
mobile surface.

---

### M-06 — Booking lookup leaks PII and is brute-forceable

**Evidence**

- `apps/api/src/modules/booking/booking.service.ts:216-260` looks up a booking by
  `bookingReference + customerPhoneSnapshot` and returns customer name, phone, and email plus the
  full location and service.
- References are `{tenantPrefix}-{4 chars}` from a 32-symbol alphabet
  (`booking.service.ts:11,278-293`) — about 1.05M combinations per prefix, and the prefix is
  public (M-01).
- The only protection is `PUBLIC_BOOKING_LOOKUP` at 30/minute per spoofable IP (M-02).
- `apps/api/src/app.ts:407` is unauthenticated.

**Impact**

Enumeration of bookings once a target phone number is known, and exposure of customer name and
email for any guessed pair. Phone numbers in the launch market are guessable in bulk.

**Required change**

- Prefer an authenticated owner lookup: bookings must be tied to the signed-in customer
  (`Customer.userId` already exists), and only return bookings belonging to that account.
- If reference + phone must remain, generate references with a CSPRNG and at least 8 characters;
  add per-reference, per-phone, and per-account rate limits with exponential backoff and audit
  every failed attempt.
- Mask PII in the response (`A••••a`, partially masked phone) and return only what the lookup
  screen needs.
- Notify the customer on repeated failed lookups for their reference.
- Do not return `customerEmail` unless it was supplied for that booking.

**Acceptance test**

Brute-force test over 100 references triggers 429/backoff; response contract excludes full email
and phone; a customer session can only fetch its own bookings.

---

### M-07 — Customer login has no lockout, and contact ownership is never verified

**Evidence**

- `apps/api/src/modules/auth/customer-auth.service.ts:60-73`: `login` performs a bcrypt compare
  but never records failures. Admin login implements `recordFailedLogin` and `lockedUntil`
  (`auth.service.ts:39-46,281-294`); customer login does not.
- Registration (`customer-auth.service.ts:24-58`) and tenant self-signup
  (`onboarding.service.ts:77-138`) accept any email/phone without verification, and tenant signup
  immediately creates an admin session.
- `findCustomerByIdentifier` (`customer-auth.service.ts:239-254`) matches email case-insensitively
  but mobile numbers exactly, so formatting variants create inconsistent identities.

**Impact**

Credential stuffing against customer accounts is unthrottled per account. Unverified contact
details allow someone to register a business or account with another person's email, and support
flows that trust email become unsafe.

**Required change**

- Apply the same per-account failed-attempt counter and lockout to customer login and OTP
  authentication, with progressive delays and email notification after repeated failures.
- Verify email and phone before: enabling login, creating a tenant, or allowing booking contact
  details to be trusted. Use a one-time token, not a magic link that lands in a web app.
- Normalise phone numbers to E.164 at write and read time (use the same normaliser for customer
  lookup, booking, and admin search).
- Add breached-password checks (k-anonymity API or offline list) and reject the seeded default
  password in production.
- Return generic responses that do not distinguish unknown/unverified/locked accounts.

**Acceptance test**

Ten failed customer logins lock the account for the configured window; registrations require
verification before login; `+91 98765 43210` and `+919876543210` resolve to the same account.

---

## P1 findings

### M-08 — No MFA or step-up authentication for admin actions

Platform actions can activate, suspend, or delete tenant visibility, cancel any booking, and
anonymise customers (`apps/api/src/app.ts:428-453`). A 30-day cookie is the only factor. Add TOTP
or WebAuthn for platform admins (required) and tenant owners/admins (recommended), plus a
freshness check (e.g. re-auth within 15 minutes) for tenant lifecycle, anonymization, and
category deactivation. Audit MFA enrollment and failures.

### M-09 — Session lifecycle is too permissive

30-day admin sessions (`auth.service.ts:16,51,79`) and 365-day trusted customer sessions
(`customer-auth.service.ts:18,255`) have no idle timeout, rotation, or per-device revocation.
`Session` has no device metadata or `lastUsedAt` (`schema.prisma:119-132`). Password reset deletes
all sessions, which is good, but membership/role changes and tenant suspension do not revoke
sessions. Add idle + absolute timeouts, token rotation, session listing/revocation (M-04),
revocation on privilege change, and a concurrent-session cap.

### M-10 — Account enumeration and lockout disclosure

`POST /public/auth/register` returns `409 An account already exists...` and tenant signup returns
field-specific conflicts (`onboarding.service.ts:77-92`). Admin login reveals
`403 Account is temporarily locked` (`auth.service.ts:39-46`), which the mobile app surfaces.
That both confirms a valid account and enables a targeted lockout. Return uniform responses and
move lockout decisions to server-side risk scoring; do not disclose lock state.

### M-11 — Tenant isolation is wrapper-only

`tenantAuth` verifies membership against `request.params.tenantId`
(`apps/api/src/app.ts:354-357`), but service methods trust the `tenantId` argument — for example
`getDashboard` and `getProfile` (`tenant-admin.service.ts:31,48`) do not re-check the caller. One
future route mounted without the wrapper leaks data. Move the check into the service layer by
passing `AuthContext` and scoping every query; add cross-tenant integration tests for every tenant
route, including nested booking/availability IDs.

### M-12 — Rate limiting can silently degrade

`apps/api/src/app.ts:178-290` uses Upstash only when both env vars are present; otherwise it uses
a per-process in-memory map. In serverless or multi-instance deployments each instance has its
own counters, so limits multiply by instance count; a cold start resets them. Make the shared
store mandatory in production (fail startup if missing), add a per-account limiter, and expose
remaining/reset headers.

### M-13 — Unbounded upload buffering

`apps/api/src/app.ts:296` configures Multer with `memoryStorage()` and no `limits`. The size check
runs only after the whole file is buffered (`upload.service.ts:57-64`). Add
`limits: { fileSize: UPLOAD_MAX_IMAGE_BYTES, files: 1, fields: 10 }`, reject early on
`Content-Length`, enforce timeouts, and scan/strip images. Keep MIME sniffing server-side (do not
trust `file.mimetype` alone).

### M-14 — Account deletion leaves PII behind

`customer-auth.service.ts:181-203` anonymises `Customer` rows and the `User`, but:
booking snapshots (`Booking.customerNameSnapshot`, `customerPhoneSnapshot`,
`customerEmailSnapshot`, `customerNote`), `BookingAttemptLog` PII, `NotificationLog.recipientEmail`
and `payload`, and audit log JSON retain personal data. There is also no audit event for
deletion. Implement a transactional erasure/anonymisation job covering all of these, preserve
non-PII operational fields, and record an audit entry with actor and scope. Add a documented
retention schedule for DPDP compliance.

### M-15 — Booking reference entropy and RNG

`booking.service.ts:11,278-293` uses `Math.random` over 32 symbols and 4 characters. Use
`crypto.randomInt`, at least 8 characters, and keep the unique constraint + collision retry.
Combined with M-06 this is required, not cosmetic.

### M-16 — Cookie and cache hardening

Session cookies are named `neara.sid` / `neara.customer.sid`, carry no `__Host-` prefix, are
`Secure` only when `NODE_ENV=production`, and the cookie parser returns the first matching name
(`auth.service.ts:333-350`). Auth responses do not set `Cache-Control: no-store`. Use
`__Host-` prefixed cookies (Path=/, Secure, no Domain), `SameSite=Strict` for admin cookies,
always `Secure` for non-local environments, reject duplicate or oversized cookie headers, and add
`Cache-Control: no-store` + `Pragma: no-cache` to auth/session responses. Do not rely on
`timingSafeEqual` for comparing secrets as strings as done in `safeCompare`
(`auth.service.ts:367-372`); compare hashes in constant time.

### M-17 — Raw admin payloads and PII in logs

Platform booking and tenant endpoints return full records including customer contact details
(`platform-admin.service.ts:137-155,413-426`) and notification logs include recipient addresses
and payloads. Audit JSON stores before/after snapshots that may contain PII. Minimise/mask PII in
API responses by role, add a separate privileged "reveal contact" endpoint with its own audit,
redact PII in audit JSON where practical, and enforce retention.

### M-18 — Transport and platform hardening

There is no Helmet/HSTS or security header middleware in `apps/api/src/app.ts`. Add HSTS
(includeSubDomains, preload), `x-content-type-options: nosniff`, `referrer-policy`,
`permissions-policy`, TLS 1.2+ only at the edge, and a WAF. For native apps, certificate pinning
requires a config plugin/custom dev client; document the pinned public keys and rotation process.
Expo Go cannot pin certificates.

---

## Required client-side follow-ups (not backend)

These are tracked here because they depend on backend decisions:

1. ~~**Cookie capture dependency.**~~ Resolved: the app now stores bearer/refresh tokens in
   `expo-secure-store` and no longer reads `Set-Cookie` (`src/lib/cookies.ts` was deleted).
2. **Certificate pinning, jailbreak/root detection, screenshot protection.** Not implemented in
   the Expo managed build. A custom dev client/config plugin is required before handling
   regulated data.
3. **Keychain persistence on reinstall (iOS).** SecureStore items can survive an app reinstall.
   Backend device-session listing/revocation (M-04) is the durable mitigation; the client clears
   its jar on an unrecoverable session.
4. **Deep links.** Only booking references and tenant slugs are routable. No tokens, passwords, or
   PII are placed in URLs. Keep it that way when adding links.

---

## Verification checklist for the backend agent

- [ ] Contract test: public tenant/slot responses contain no private expert or internal tenant
      fields (M-01).
- [ ] Rate-limit test with rotating `X-Forwarded-For` still triggers 429 (M-02).
- [ ] OTP: five wrong attempts invalidate the code and the correct sixth attempt fails (M-03).
- [ ] Customer account lockout after N failed logins; generic messages (M-07, M-10).
- [ ] Mobile auth endpoint returns role + audience-bound access/refresh tokens; plain customers
      cannot obtain an admin-audience session (M-04).
- [ ] CSRF required on customer mutations and both logout endpoints (M-05).
- [ ] Booking lookup is owner-scoped or hardened with per-reference limits and masked PII (M-06).
- [ ] Cross-tenant tests for every `/admin/tenant/:tenantId/*` route (M-11).
- [ ] Upload over `UPLOAD_MAX_IMAGE_BYTES` is rejected before buffering (M-13).
- [ ] Account deletion erases snapshots/log payloads and writes an audit entry (M-14).
- [ ] `Authorization: Bearer` rejected for admin web cookies and vice versa; stale cookies on the
      mobile surface do not authenticate (M-04/M-16).

## Mobile verification already run

- `cd apps/mobile && npx tsc --noEmit` — passes.
- `cd apps/mobile && npx expo export --platform android` and `--platform ios` — production JS bundles build.
- Session handling: bearer/refresh tokens in `expo-secure-store`, single-flight refresh with one
  request replay on a 401, forced local sign-out when the refresh token is rejected, foreground
  revalidation, and HTTPS fail-closed in release builds.

---

## Resolution status (backend implementation, 2026-11-05)

All backend findings are implemented on `feature-security-hardening`. Existing web, mobile and
API flows were kept working: cookie sessions remain the web contract, the bearer surface is
additive, and enforcement that could lock out existing accounts is behind explicit flags.

| ID | Status | Where |
| --- | --- | --- |
| M-01 | Done | `modules/public/public.service.ts`, `modules/scheduling/scheduling.service.ts` — explicit `select` projections; contract test in `public.service.spec.ts` |
| M-02 | Done | `modules/rate-limit/rate-limiter.ts` — keys on Express `request.ip` with `TRUST_PROXY_HOPS`; client XFF is never parsed |
| M-03 | Done | `modules/auth/otp.service.ts` — CSPRNG codes, hashed at rest, attempt counter on every failure, purpose lock + notification, max live codes |
| M-04 | Done | `modules/auth/mobile-auth.service.ts`, `/api/mobile/auth/*` (login, refresh, logout, logout-all, sessions, session revoke, me, account delete, password-reset); bearer tokens also accepted by the existing admin/customer guards |
| M-05 | Done | CSRF + Origin/Sec-Fetch-Site on customer logouts, account deletion, booking creation, and all admin mutations |
| M-06 | Done | `modules/booking/booking.service.ts` — owner-scoped lookups, masked guest responses, per-IP/per-reference/per-phone limits, failed-lookup audit |
| M-07 | Done (flows flag-gated) | lockout + E.164/email normalisation + verification endpoints (email OTP, SMS/WhatsApp phone OTP); enforcement behind `AUTH_REQUIRE_*` |
| M-08 | Done | TOTP MFA (`/admin/auth/mfa/*`), step-up freshness for suspend/inactivate/anonymize |
| M-09 | Done | `modules/auth/session.service.ts` — idle + absolute expiry, rotation, cap, listing and revocation |
| M-10 | Partially done | Login/lockout/OTP responses are generic; registration and tenant signup still return an explicit 409/409 (documented trade-off) |
| M-11 | Done | service-layer `assertScope` on every `/admin/tenant/:tenantId/*` operation, not just route wrappers |
| M-12 | Done | shared store required in production/staging; store errors fail closed with 503 |
| M-13 | Done | Multer `limits` + `Content-Length` pre-check + magic-byte sniffing (stored type/extension derived from bytes) |
| M-14 | Done | self-delete and platform anonymise erase snapshots, attempt logs, notification payloads, OTP/reset material, sessions and audit PII |
| M-15 | Done | 8-character CSPRNG booking references; existing references remain resolvable |
| M-16 | Done | `__Host-` + Secure + SameSite cookies, `no-store` on auth responses, ETag disabled |
| M-17 | Done | platform booking list masked, detail view audited, tenant detail no longer returns user password hashes/MFA seeds, PII `console.log` removed |
| M-18 | Done (API) | `support/security.ts` security headers incl. HSTS in production; certificate pinning remains a native build concern |

### Session model

- Admin cookie: 12h absolute, 30m idle, `SameSite=Strict`.
- Customer cookie: 7d absolute, 24h idle (`SameSite=Lax`); trusted device 30d/7d.
- Mobile bearer: 15-minute HS256 access token bound to `deviceId` + refresh family, rotating
  30-day refresh tokens hashed at rest, reuse revoking the whole family.
- Password reset, platform-created admin, tenant suspend/inactivate and anonymisation revoke
  every session and refresh family for the affected user.

### New/changed configuration

`TRUST_PROXY_HOPS`, `COOKIE_SECURE_INSECURE_DEV`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_REQUIRE_SHARED_STORE`, `ALLOW_IN_MEMORY_RATE_LIMIT`,
`RATE_LIMIT_TENANT_SIGNUP_PER_HOUR`, `RATE_LIMIT_CLIENT_EVENTS_PER_MINUTE`,
`RATE_LIMIT_MOBILE_AUTH_PER_MINUTE`, `RATE_LIMIT_MOBILE_REFRESH_PER_MINUTE`,
`AUTH_ADMIN_SESSION_ABSOLUTE_HOURS`, `AUTH_ADMIN_SESSION_IDLE_MINUTES`,
`AUTH_CUSTOMER_SESSION_ABSOLUTE_DAYS`, `AUTH_CUSTOMER_SESSION_IDLE_HOURS`,
`AUTH_CUSTOMER_TRUSTED_ABSOLUTE_DAYS`, `AUTH_CUSTOMER_TRUSTED_IDLE_DAYS`,
`AUTH_MAX_ACTIVE_SESSIONS`, `AUTH_LOCKOUT_THRESHOLD`, `AUTH_LOCKOUT_MINUTES`,
`AUTH_OTP_MAX_ATTEMPTS`, `AUTH_OTP_MAX_ACTIVE`, `AUTH_ACCESS_TOKEN_MINUTES`,
`AUTH_REFRESH_TOKEN_DAYS`, `AUTH_STEP_UP_MINUTES`, `AUTH_REQUIRE_PLATFORM_MFA`,
`AUTH_REQUIRE_EMAIL_VERIFICATION`, `AUTH_REQUIRE_PHONE_VERIFICATION`, `SMS_PROVIDER`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`.

All are documented in `.env.example`. Defaults keep current behaviour; turn the
`AUTH_REQUIRE_*` flags on once the verification/MFA flows have been exercised in production.

### Verification run

- `cd apps/api && npx prisma generate && npx tsc --noEmit` — passes.
- `cd apps/api && npx jest` — 15 suites / 72 tests pass, including new tests for rotating-XFF
  rate limiting, OTP lockout/channel scoping, Twilio delivery (SMS + WhatsApp, failure and
  disabled-provider paths), mobile role/audience issuance, refresh reuse detection, booking
  lookup masking/ownership, tenant scope rejection and the public response contract.
- `cd apps/web && npx tsc --noEmit` — passes (client now sends `x-csrf-token` on mutations).
- `cd apps/mobile && npx tsc --noEmit` — passes against the bearer client.
- Migrations added: `20261105090000_security_hardening`, `20261105091000_sms_channel`.

### Known residual risks / follow-ups

1. **SMS sender registration.** Phone verification needs `SMS_PROVIDER=twilio` plus a verified
   sender (and a WhatsApp template/sandbox join in production). Until then the endpoints answer
   `503` rather than pretending to send, so `AUTH_REQUIRE_PHONE_VERIFICATION` stays off.
2. **Verification enforcement.** Both channels are wired; email and phone verification endpoints
   exist and enforce generic responses. The `AUTH_REQUIRE_*` flags stay off by default so
   existing accounts are not locked out, and `AUTH_REQUIRE_PLATFORM_MFA` remains off for the same
   reason.
3. **Enumeration trade-off.** Registration and tenant signup still answer `409` on duplicate
   identifiers because the UX depends on it; both are rate limited. Login, OTP, reset and mobile
   auth are generic.
4. **Platform-admin PII.** Support staff can still read a single booking's contact details; that
   access is now audited (`booking.detail.view`). Retention policy for that audit trail is an
   operational decision.
5. **Certificate pinning, WAF, edge TLS 1.2+** remain deployment/native-build items (M-18).

### Client migration, SMS channel and session screens (2026-11-05)

**Mobile bearer migration.** `apps/mobile` no longer uses cookies:

- `src/lib/session-store.ts` keeps access/refresh tokens, expiry and device metadata in
  `expo-secure-store`; `src/lib/http.ts` attaches `Authorization: Bearer`, refreshes once on a 401
  through `src/auth/token-refresh.ts`, replays the request, and signs out locally if the refresh is
  rejected. `src/lib/cookies.ts` is gone.
- `src/api/auth.ts` uses `/api/mobile/auth/{login,refresh,logout,logout-all,sessions,me}`.
  Registration keeps `POST /public/auth/register` (its cookies are ignored) and then calls
  `/mobile/auth/login` once, so the password is verified exactly once.
- Account deletion is `DELETE /api/mobile/auth/me`, which reuses `CustomerAuthService.eraseForUser`.
- The API side accepts these tokens in the **existing** `requireAdminContext` /
  `requireCustomerContext` guards: an `Authorization: Bearer` request is resolved by
  `MobileAuthService.requireContext` with the route's allowed audiences, and CSRF is skipped only
  for that path (cookie requests still require it). No data route was duplicated under
  `/api/mobile`.

**SMS / WhatsApp OTP.** `modules/notification/sms.service.ts` posts directly to the Twilio REST
API with `fetch` (no SDK): SMS uses `TWILIO_SMS_FROM`, WhatsApp prefixes both numbers with
`whatsapp:` and uses `TWILIO_WHATSAPP_FROM`. `OtpService` is now channel-aware — a code is bound
to the channel it was issued for, so an SMS code cannot be replayed as an email code — and
`NotificationChannel.sms` records the delivery. New endpoints:

- `POST /api/public/auth/verify/phone/request` — `{ identifier, channel: 'sms' | 'whatsapp' }`.
- `POST /api/public/auth/verify/phone/confirm` — `{ identifier, otp, channel }`, sets
  `mobileVerifiedAt` and is what `AUTH_REQUIRE_PHONE_VERIFICATION` checks at login.
- `POST /api/public/auth/otp/request` and the login confirm endpoint accept an optional `channel`.
- Both phone endpoints answer `{ ok: true }` for unknown identifiers and are rate limited per IP
  and per identifier.
- `user` payloads now expose `mobileVerified` (mobile bearer and cookie surfaces) plus
  `emailVerified`/`mfaEnabled` on the customer cookie surface, so clients can show state instead of
  guessing.

**Session management.** `GET/DELETE /api/{admin,public}/auth/sessions` already existed; the apps
now surface them:

- Web customer: `/profile/sessions` (`app/profile/sessions/page.tsx`) and a profile shortcut.
- Web admin: `/admin/platform/sessions` with a sidebar entry.
- Mobile: `/sessions` screen, linked from the customer account, tenant home and platform system
  screens, with per-device revoke and "sign out everywhere" (`signOutEverywhere`).
- The list merges cookie sessions and native refresh families, so revoking a phone from the web
  takes effect on its next request.

**Verification screens.**

- Mobile: `/verify-phone` (linked from the customer account) sends a code over SMS or WhatsApp to the
  number on the account, confirms it with a 30-second resend cooldown, and refreshes the session so
  the account shows `Verified`.
- Web: the customer profile shows a mobile-verification card with the same flow, and an MFA status
  card. Customer accounts cannot enroll TOTP — that remains an admin-console capability — so the
  card reports status and explains the alternatives rather than offering a toggle that would not
  work.
