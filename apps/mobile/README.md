# Neara Mobile

Hybrid native client for Neara, built with Expo (SDK 58) and Expo Router. One app package serves
customers, tenant teams, and platform admins; the signed-in role decides which interface mounts.

- Android: Expo Go / dev build / EAS build
- iOS: Expo Go / dev build / EAS build
- Web bundling is not a target. The app is mobile-only by design.

## Role-based routing

| Signed-in role | Interface | Route group |
| --- | --- | --- |
| Customer (no membership, no platform role) | Discover, studio page + booking, appointments, account | `app/(customer)` |
| Owner / admin / staff membership | Dashboard, bookings + status transitions, studio toggles, tenant switcher | `app/(tenant)` |
| `platformRole` = `platform_admin` | Tenants + lifecycle, all bookings + cancel, categories, audit/notification logs | `app/(platform)` |

Resolution rules, all server-verified:

1. `POST /public/auth/login` is tried first. Customer login rejects accounts that hold a
   membership or platform role, which is why it is the safe default.
2. Only on a genuine 401 with an email identifier does the app try `POST /admin/auth/login`
   (that endpoint accepts any active user, so it needs the extra guard).
3. The role is then read from `GET /public/auth/me` or `GET /admin/auth/me`, never from the
   login payload. An admin-audience session with no admin role is revoked immediately.
4. Platform role wins over tenant membership. Tenant users get a switcher that persists the
   chosen tenant id only.
5. Every route group has a guard that redirects when the session does not match. Guards are UX
   only; the API remains the authority for every read and mutation.

## Setup

Requirements: Node 20+, npm 10+, the Neara API reachable from the device, and Xcode/Android
Studio only if you build a native binary locally.

```bash
# from the repository root
npm install

cp apps/mobile/.env.example apps/mobile/.env
# edit EXPO_PUBLIC_API_URL (no trailing slash)

npm run start -w @neara/mobile
```

Then press `a` for Android or `i` for iOS in the Expo CLI, or scan the QR code with Expo Go.
Physical devices need the API on your LAN, for example
`EXPO_PUBLIC_API_URL=http://192.168.1.20:4000`.

`EXPO_PUBLIC_API_URL` defaults to `http://10.0.2.2:4000` on Android and `http://localhost:4000`
on iOS in development. Release builds **refuse to start** if the URL is not `https://`.
The hosted API mounts every route under `/api`, so its base URL is
`https://neara-api.vercel.app/api` — without `/api` every call returns 404.

The API must allow the app's origin-less native requests. No extra CORS entry is needed for
native fetch, but the API host must be reachable over TLS in production.

## Scripts

```bash
npm run start -w @neara/mobile       # Expo dev server
npm run android -w @neara/mobile     # dev server + Android
npm run ios -w @neara/mobile         # dev server + iOS (macOS)
npm run typecheck -w @neara/mobile   # tsc --noEmit
```

## Building for stores

1. Set the production API URL in the build environment:
   `EXPO_PUBLIC_API_URL=https://api.your-domain.com`.
2. Install EAS CLI and sign in: `npm i -g eas-cli && eas login`.
3. Configure the project once: `eas build:configure` (uses `eas.json` in this folder).
4. Build:
   - Android: `eas build --platform android --profile production`
   - iOS: `eas build --platform ios --profile production`
5. Submit with `eas submit -p android` / `eas submit -p ios`.

Update `expo.ios.bundleIdentifier` and `expo.android.package` in `app.json` before the first
store build if `com.neara.app` is not the final identifier. The app uses Expo SecureStore, so a
development build is required to test the real keychain/keystore behaviour; Expo Go is fine for
UI work.

## Security model

- **Session storage.** Session cookies are persisted only in `expo-secure-store` with
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; never in AsyncStorage, never in plain files. Android backup is
  disabled for the secure store via the `expo-secure-store` config plugin.
- **Cookie handling.** React Native has no browser cookie jar, so `src/lib/cookies.ts` parses
  `Set-Cookie` into an encrypted jar and replays `Cookie` plus `x-csrf-token` explicitly with
  `credentials: 'omit'`. Only host-only, path-matching, unexpired cookies are sent. Session
  confirmation via `/me` after login catches a missed cookie before any role UI is shown.
- **No client-trusted authorization.** Roles come from a fresh server `/me` response, and every
  screen re-fetches through authenticated endpoints. A role mismatch redirects, but a forged local
  state cannot read data the API will not return.
- **Forced sign-out.** Any 401 on a session-bound request clears the jar, preferences, and in-memory
  state. Sessions are also revalidated when the app returns to the foreground (throttled to once a
  minute).
- **Transport.** HTTPS is mandatory in release builds; the app fails closed otherwise. Error
  messages are generic and never include tokens, cookies, passwords, or raw server internals.
- **Least-privilege scope.** Destructive provisioning and PII operations stay on the web admin:
  tenant creation, first-admin provisioning, customer anonymization, queue inspection, image
  uploads, and admin password reset. The mobile app has no UI that can call them.
- **No secrets in URLs or logs.** Deep links carry only tenant slugs and booking references.
  Passwords are never persisted, logged, or put in navigation params.

The full API-side review — including findings the backend must fix before launch — is in
[`doc/16-mobile-security-backend-actions.md`](../../doc/16-mobile-security-backend-actions.md).
Read it before shipping: it documents cookie-session limits for native clients and the required
`/api/mobile/auth` token contract.

## Screens

Customer:

- Discover: search, category chips, locality filter, availability badge
- Studio: services, expert filter, date strip, live slots, booking form with consent
- Appointments: upcoming/past, booking receipt, cancel when allowed, reference lookup
- Account: profile, tenant links, sign out, delete account

Tenant:

- Dashboard: today/upcoming counts, quick links, tenant switcher
- Bookings: paged/status-filtered list, detail with confirm/complete/cancel/no-show
- Studio: service and expert visibility toggles, booking policy and public contact read-only

Platform:

- Overview: tenant counts, recent tenants
- Tenants: search/filter, lifecycle actions, detail with members and booking stats
- Bookings: all bookings, detail + cancel
- System: category create/toggle, audit log, notification log

## Deliberately not in the mobile app

These remain web-only and are intentionally not exposed to the mobile client:

- Tenant creation and first-admin provisioning
- Customer PII anonymization
- Notification queue inspection/retry
- Image uploads
- Admin password reset (needs a mobile reset contract first)
- Tenant self-signup and email/phone verification flows

## Project structure

```
app/
  _layout.tsx           providers, splash, stack
  index.tsx             role-based redirect
  sign-in.tsx           unified sign-in
  register.tsx          customer registration
  forgot-password.tsx   OTP password reset
  (customer)/           customer tabs + tenant/[slug]
  (tenant)/             tenant tabs + bookings/[id]
  (platform)/           platform tabs + tenants/[id], bookings/[id]
src/
  api/                  typed endpoint clients
  auth/                 AuthProvider, role resolution, route guards
  components/           layout, controls, display, provider card
  lib/                  secure storage, cookie jar, http, config, formatting
  types.ts              API response types
```

## Verification performed

- `npx tsc --noEmit` passes.
- `npx expo export --platform android` produces a production JS bundle.
- `npx expo export --platform ios` produces a production JS bundle.
- Runtime against a live API was **not** exercised in this environment; the API/database were not
  running. Before release, smoke-test sign-in for all three roles, booking creation, status
  transitions, tenant switching, and forced sign-out on session expiry.

## Known mobile limitations

- Cookie replay via `Set-Cookie` is a compatibility layer, not the long-term design. Replace it
  with the bearer/refresh contract in the security document.
- No certificate pinning, jailbreak/root detection, or screenshot blocking. These need a custom
  dev client/config plugin and are tracked as pre-launch work for regulated data.
- The app does not cache data offline. A lost connection shows a retryable error rather than
  stale privileged data.
- iOS keychain items can survive an app reinstall; server-side session revocation is required to
  cover that case.
