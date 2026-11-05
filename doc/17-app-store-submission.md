# Neara iOS — App Store Submission

Status: pre-submission  
Scope: `apps/mobile` (Expo), `apps/web` public policy pages, App Store Connect  
Target: version 1.0.0, build from the EAS `production` profile, App Store Connect app `6831122783`  
Public domain: `https://neara.co.in` (the bundle identifier `in.neara.app` is unrelated and stays)
Date: 2026-11-05

This is the working checklist for the first App Store release. The TestFlight build is already
verified. Everything that can be done in the repository has been done; the remaining owner actions
are marked **OWNER** and need App Store Connect, Apple, or production credentials.

## Gap tracker

| # | Gap | Status in repo | Remaining action |
|---|---|---|---|
| 1 | Privacy policy + support URL live, linked in app | Pages added at `/privacy`, `/terms`, `/support`; links added to sign-in, customer account, business signup, studio screen | **OWNER:** deploy `apps/web` to `neara.co.in`, confirm the policy text with counsel, confirm `support@neara.co.in` is monitored |
| 2 | Demo account for review | Review notes and setup steps below | **OWNER:** create the two demo accounts on the production API and paste credentials into App Review Information |
| 3 | Business account deletion | In-app request flow in Studio → Business account | **OWNER:** monitor `support@neara.co.in`; add a true `DELETE` endpoint if review pushes back |
| 4 | iPad support decision | `ios.supportsTablet` set to `false` for 1.0.0 | Re-enable only after the layout is tested on a 13" iPad and screenshots exist |
| 5 | Production API verification | `publish:ios` now fails if `https://neara-api.vercel.app/api/health` is unhealthy and prints dependency status | **OWNER:** fix Redis/queue configuration on production (see below) |
| 6 | App Privacy answers | Answers below | **OWNER:** enter them in App Store Connect |

## 1. Policy and support URLs

New public pages, linked from the mobile app:

| Page | URL | Used for |
|---|---|---|
| Privacy policy | `https://neara.co.in/privacy` | App Store privacy policy URL, in-app links |
| Terms of use | `https://neara.co.in/terms` | Business signup consent, in-app links |
| Support | `https://neara.co.in/support` | App Store support URL, in-app help links |

Deploy the web app before submitting and check each URL returns 200 in a private window. The app
uses these URLs directly in `apps/mobile/src/lib/links.ts`, so changing the domain needs a new
build. The API only accepts browser requests from `WEB_APP_URL` (plus `CORS_ALLOWED_ORIGINS`), so
set `WEB_APP_URL=https://neara.co.in` in the API environment when the domain goes live.

The policy text describes the data the app actually handles (account details, bookings, studio
listing data, session and security data, email delivery status), names no advertising or
cross-app tracking, and describes the in-app deletion paths. Have counsel confirm the entity name,
grievance contact, and retention wording before publishing.

## 2. Demo accounts for App Review

App Review must be able to sign in and complete the core flow without contacting you.

Create these on the **production** API (not staging), using addresses you control:

| Role | Purpose | Requirements |
|---|---|---|
| Customer demo | Browse, book, view appointments, delete account | Verified email, at least one booking possible |
| Studio owner demo | Studio dashboard, bookings, studio settings | Active tenant with category, primary location, at least 2 services, 2 experts, availability rules, and a public page |

Setup steps:

1. Register the customer through the app (`/register`) and complete one booking on the demo studio.
2. Register the studio through `/business-signup`, then finish Studio → Setup: profile, primary
   location, services, experts, service assignments, and weekly availability.
3. Ask a platform admin to activate the tenant if self-serve activation is not enabled.
4. Confirm both accounts work from a clean install of the TestFlight build.
5. Put both credential pairs in App Store Connect → App Review Information → Sign-In Information.
   Use a dedicated demo password, and rotate it after review.

Review notes are below; paste them into Review Notes with the credentials filled in.

## 3. Business account deletion

The customer app already deletes accounts instantly (`Account → Delete account`,
`DELETE /public/auth/me`). Studio accounts had no in-app path, which is a Guideline 5.1.1(v) risk.

Studio → Business account now has **Delete business account**. It shows what is removed and what is
retained, then opens a pre-filled deletion request to `support@neara.co.in` with the business name and
account email. Support completes it within 7 days.

This is an in-app request path, not an automatic server-side deletion. If review rejects it as
"contact support only", the follow-up is a real API endpoint that archives the tenant, removes the
owner membership, anonymises the owner user, and preserves booking records. That is destructive and
needs a retention decision, so it was not invented here.

## 4. iPad

`ios.supportsTablet` is now `false`. TestFlight testing was on iPhone, and leaving tablet support on
would require 13" iPad screenshots and an iPad layout review for 1.0.0. Re-enable it in a later
release once iPad is tested and screenshots are ready.

## 5. Production API check

The publish script now checks the API baked into the build before starting EAS:

- `GET {EXPO_PUBLIC_API_URL}/health` must return 200 with `{ "ok": true }`, or the build is refused.
- `GET {EXPO_PUBLIC_API_URL}/health/dependencies` is printed; failing dependencies produce a warning.

Checked on 2026-11-05 against `https://neara-api.vercel.app/api`:

```text
health:       200 {"ok":true,"service":"neara-api"}
database:     ok
redis:        NOT READY — "Connection is closed."
email:        ok (configured)
storage:      NOT READY — "Vercel Blob token is not configured"
```

Before submitting:

- **Redis:** configure the production Redis/Upstash URL. Without it, rate limiting falls back to
  per-process memory and queued notification/reminder jobs cannot run.
- **Storage:** not used by the mobile app (image uploads are web-only), but configure it if studio
  logos are expected to work in the production web admin.
- Confirm the API is the real production deployment, not a preview, and that migrations are applied.
- Send a live booking confirmation email from a production build and confirm it arrives.

## 6. App Privacy answers

App Store Connect → App Privacy. Answers match the current app; update them if you add analytics,
crash reporting, or social login.

**Do you or your third-party partners collect data from this app?** Yes.

| Data type | Collected | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| User Content → Other User Content (booking notes, studio listing content) | Yes | Yes | No | App Functionality |

- **Tracking:** No. The app has no advertising SDK, no cross-app tracking, and no data broker
  sharing.
- **Advertising identifier:** not used.
- **Analytics / crash data:** no third-party analytics or crash SDK is bundled. Server request logs
  stay on infrastructure you control; declare them only if you add a vendor that surfaces them in
  the app.
- **Location:** not collected. Studio addresses are typed business information, not device location.
- **Payments:** no payment card data; payments happen directly with the studio.
- **Account deletion:** yes, available in-app for customers and by in-app request for studios.

## Build and submit

Prerequisites:

- EAS login with access to the `lumiq-team` project and the Apple team that owns `in.neara.app`.
- An App Store distribution certificate and provisioning profile. EAS creates them on the first
  interactive build; `--non-interactive` cannot.
- An App Store Connect API key for non-interactive submits (or an Apple ID session).

Commands:

```bash
# from repo root
npm --workspace apps/mobile run typecheck

cd apps/mobile
npx eas-cli login
npx eas-cli whoami

# first submission: interactively (credential setup)
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

After credentials exist, the one-shot script builds, uploads, and prints the build id:

```bash
npm --workspace apps/mobile run publish:ios
```

This uploads to App Store Connect. It does **not** submit the app for review — there is no EAS
command for that.

## App Store Connect checklist

App record `6831122783`, version `1.0.0`:

- [ ] Build attached and finished processing (watch for Apple emails about icons or privacy
      manifests).
- [ ] Screenshots: 6.9" iPhone (required). No iPad set while `supportsTablet` is false.
- [ ] Description, keywords, promotional text, support URL, privacy policy URL.
- [ ] Category: Lifestyle (primary), Business (secondary).
- [ ] Age rating: 4+ (no unrestricted web access, no user-generated public content beyond studio
      listings).
- [ ] Pricing: free; availability: India at minimum.
- [ ] App Privacy answers entered as above.
- [ ] Content rights: you have rights to studio listing content.
- [ ] Export compliance: no non-exempt encryption (`ITSAppUsesNonExemptEncryption` is already
      `false`).
- [ ] Sign-In Information: customer and studio demo credentials.
- [ ] Review notes (below).
- [ ] Version release: **manually release** after approval.
- [ ] Submit for review.

## Review notes (paste into App Store Connect)

```text
Neara is an appointment booking app for studios and their customers in India.

Sign-in for review:
  Customer: <email> / <password>
  Studio owner: <email> / <password>

The customer account can browse studios, book an appointment, view it under Appointments, and
delete the account from Account > Delete account.

The studio owner account manages bookings and studio settings under the Studio tab.

There are no in-app purchases or payments. Customers pay the studio directly; the app never
collects card details.

There is no social or third-party login, so Sign in with Apple is not applicable.

The platform admin workspace is internal and not part of this submission.

Privacy policy: https://neara.co.in/privacy
Terms of use: https://neara.co.in/terms
Support: https://neara.co.in/support

Contact: support@neara.co.in
```

## After approval

1. Release manually, then watch App Store Connect → Trends and the API error logs for 48 hours.
2. Keep the 1.0.0 build available. App Store Connect cannot un-release a version; the only rollback
   is a fast 1.0.1.
3. Rotate the demo passwords.
4. Every JS change needs a new build and review — `expo-updates` is not configured.
