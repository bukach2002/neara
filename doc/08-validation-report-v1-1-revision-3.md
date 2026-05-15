# Validation Report: Requirements v1.1 Resolved3

Validated file: `multi_tenant_appointment_platform_requirements_v1_1_resolved3.md`

Previous validation baseline: `v1_1_validation.md`

## Executive Summary

`resolved3` closes almost all of the major implementation blockers found in the prior validation.

The spec is now **close to build-ready**, with no major product-scope blockers remaining. However, it is **not completely ambiguity-free**. A few implementation details still need explicit decisions before the relevant modules are built.

Recommended status:

- **Ready for high-level architecture and project setup**
- **Ready for database/API planning**
- **Not fully ready for complete implementation without resolving the remaining items below**

## Previously Open P0 Items

### 1. Technical stack

Status: **Mostly resolved**

Resolved decisions:

- Frontend: Next.js + React + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL + PostGIS
- ORM: Prisma
- Queue: BullMQ + Redis

Remaining ambiguity:

- Email provider is still listed as `Resend, Postmark, or SES` behind abstraction.

Impact:

- Not a core architecture blocker if the provider abstraction is implemented.
- Production email setup still needs one final provider selection.

### 2. Geospatial implementation

Status: **Resolved**

`PostgreSQL 16+` and `PostGIS enabled` are explicitly selected.

### 3. Map/geocoding provider

Status: **Mostly resolved**

Google Maps / Places / Geocoding APIs are the default MVP decision.

Remaining ambiguity:

- The spec says it can be swapped later if cost constraints are severe.

Impact:

- Acceptable if implementation uses a provider abstraction.
- If implementation hardcodes Google APIs, switching later will require rework.

### 4. Launch geography

Status: **Resolved**

Default launch is now single-country launch in India, with kilometers and India default country behavior.

### 5. Forced double-booking override

Status: **Resolved**

No override is allowed in MVP. Double-booking prevention is strict.

### 6. Manual booking outside availability

Status: **Resolved**

Manual booking creation by tenant staff is out of MVP.

## Remaining Implementation Gaps

### 1. Email provider is not final

Current text:

- Email: Resend, Postmark, or SES behind provider abstraction

Question:

- Which provider should production MVP use first?

Recommended default:

- Pick one now, even if the code uses an adapter. For fastest MVP setup, choose either Resend or Postmark.

Priority: **P1**

### 2. Rate-limit values are still missing

Current text:

- Public endpoints must be rate-limited at least per IP and per endpoint.

Missing:

- Search limit
- Slot lookup limit
- Booking creation limit
- Booking lookup limit
- Login limit
- Password reset limit

Recommended default:

- Search: 60 requests/minute/IP
- Slot lookup: 30 requests/minute/IP
- Booking create: 5 requests/minute/IP
- Booking lookup: 10 requests/minute/IP
- Login: existing lockout rule plus 10 attempts/15 minutes
- Password reset: 3 requests/hour/email or IP

Priority: **P1**

### 3. Booking reference format is still unspecified

Current text:

- Every booking must have a human-friendly booking reference code.

Missing:

- Format
- Length
- Character set
- Collision retry behavior

Recommended default:

- Format: `BK-` plus 8 uppercase Crockford Base32 characters, for example `BK-7H4K2Q9P`.
- Must be globally unique.
- Regenerate on collision.

Priority: **P1**

### 4. Auto-assignment tie-breaker is missing

Current text:

- If customer does not select expert, system returns earliest available slot across eligible experts and assigns the specific expert for that slot.

Missing:

- What happens if multiple experts have the same earliest slot?

Recommended default:

- Pick expert with lowest number of confirmed bookings that day.
- Then sort by expert display name.
- Then sort by expert UUID for deterministic fallback.

Priority: **P1**

### 5. Availability override semantics are still contradictory

Current text:

- Section 8.3 says explicit working-hour override exceptions may add availability for a specific date.
- Section 8.4 says `override` replaces the normal schedule for a specific date or range.

Why this matters:

- "Add availability" and "replace schedule" are different behaviors.

Decision needed:

- Either define `override` as full-day replacement, or split into two types.

Recommended default:

- Use:
  - `block`: removes availability
  - `special_hours`: replaces that date's normal working windows with explicit windows

Priority: **P0 before scheduling implementation**

### 6. Public address visibility is ambiguous

Current text:

- Publicly visible: approximate address or full business address.

Question:

- Should public tenant pages show the full address or only locality/city until after booking?

Recommended default:

- Show full business address for active tenants because appointments are on-site at the tenant location.

Priority: **P1**

### 7. Anonymization fields are not exact

Current text:

- MVP must support platform-admin manual anonymization on request.

Missing:

- Exact fields to clear/mask in `customers`, `bookings`, `notification_logs`, and `audit_logs`.

Recommended default:

- Anonymize customer name, phone, email, and customer note in customer and booking records.
- Keep booking reference, tenant, service, expert, status, timestamps, and non-PII operational data.
- Retain audit log action metadata but avoid storing raw PII in new audit summaries.

Priority: **P1**

### 8. Upload scope is still conditional

Current text:

- Logo upload is optional.
- Expert photo if uploaded.
- File storage is S3-compatible if enabled.

Question:

- Are logo and expert photo uploads in MVP or not?

Recommended default:

- Defer uploads for first build unless visual branding is required. Use nullable `logo_url` and `photo_url` fields that can accept externally hosted URLs or remain empty.

Priority: **P2 unless branding is launch-critical**

## New or Changed Points to Watch

### 1. Category model changed from earlier resolved spec

`resolved3` says:

- tenant belongs to one primary category
- service does not have separate categories

This is clear, but it is a product simplification from earlier versions that allowed multiple tenant categories and service categories.

Impact:

- Fine for MVP if accepted.
- Future multi-category support will require migration or additional join tables.

### 2. Clinics are included in target examples

The spec includes clinics and non-emergency consultation businesses, while also excluding sensitive medical records.

Impact:

- Acceptable if clinic usage is limited to generic scheduling.
- UI copy should warn customers not to enter medical details in notes.

### 3. Admin viewport differs from earlier goal

`resolved3` sets:

- customer minimum width: 360 px
- admin minimum width: 768 px

Impact:

- This is reasonable, but it means admin portal is tablet/desktop-first, not full small-phone-first.

## Final Verdict

`multi_tenant_appointment_platform_requirements_v1_1_resolved3.md` is **substantially resolved and suitable as the main MVP implementation baseline**.

Before scheduling logic is implemented, resolve the availability override contradiction.

Before production launch, choose the email provider and rate-limit values, and define booking reference and anonymization details.

Overall readiness:

- Product scope: **ready**
- Architecture direction: **ready**
- Data model direction: **mostly ready**
- Scheduling rules: **one blocker remains**
- Production operations: **minor decisions remain**

