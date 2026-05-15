# Validation Report: Requirements v1.1 Resolved

Validated file: `multi_tenant_appointment_platform_requirements_v1_1_resolved.md`

Baseline file: `question.md`

## Executive Summary

Version 1.1 resolves most of the blocking ambiguity from version 1.0 and is much closer to an implementation-ready MVP specification.

Overall assessment:

- Original P0 questions: mostly answered
- Original P1 questions: mostly answered or intentionally deferred
- Original P2 questions: sufficiently addressed
- New ambiguity: a small number of implementation-impacting gaps remain

Recommendation: **Do not start full build until the P0 items below are resolved.** The fixes are small, but they affect architecture, data model, booking correctness, and third-party integration choices.

## Answer Coverage

The following major areas are now sufficiently resolved:

1. MVP scope and exclusions
2. Target tenant archetypes
3. Marketplace-first product direction
4. Browser, mobile web, and accessibility support
5. Guest-only customer identity
6. Booking lookup by reference and phone
7. Admin authentication and password reset
8. Shared PostgreSQL tenancy model
9. Tenant status lifecycle
10. Tenant activation requirements
11. Service/category ownership
12. Expert profile versus expert login distinction
13. Expert-specific availability as canonical source
14. Booking statuses and allowed transitions
15. Cancellation and rescheduling scope
16. Customer booking data requirements
17. Search engine choice
18. Radius, distance unit, and ranking order
19. Branch exclusion with `locations` table now
20. Email-first notifications
21. WhatsApp foundation-only decision
22. Platform and tenant dashboard requirements
23. Audit retention and visibility
24. Database, UUIDs, soft delete, and snapshots
25. API organization and auth direction
26. Privacy baseline and sensitive-data restriction
27. Scale, response-time, uptime, backup, and observability targets
28. UI flow and expert UI exclusion
29. Support ownership
30. Required testing and documentation

## Remaining P0 Gaps

### 1. Technical stack is still not fully frozen

The spec says the recommended backend is "Node.js with NestJS or Express", and also allows the team standard stack to override it.

Why this matters:

- NestJS and Express imply different structure, validation, dependency injection, testing patterns, and OpenAPI generation.
- "Team standard may override" means a development agent still does not have a single build target.

Decision needed:

- Choose one stack for this project, for example:
  - Next.js + NestJS + PostgreSQL + BullMQ + Redis
  - Next.js + Express + PostgreSQL + BullMQ + Redis
  - another explicit team standard

### 2. Geospatial implementation remains conditional

The spec chooses PostgreSQL, but says PostGIS should be used "if geospatial querying is needed"; otherwise basic lat/lng calculations are acceptable.

Why this matters:

- Radius search is explicitly in MVP.
- PostGIS versus manual distance calculations affects migrations, indexes, query design, deployment extensions, and performance.

Decision needed:

- Since radius search is MVP, choose one:
  - require PostGIS in MVP, or
  - explicitly accept non-PostGIS Haversine queries with documented scale limits.

Recommended decision:

- Use PostgreSQL + PostGIS for MVP.

### 3. Map/geocoding provider is not final

The spec says use Google Maps if budget and keys are available, with Mapbox as fallback.

Why this matters:

- Google Maps and Mapbox have different APIs, SDKs, pricing, autocomplete behavior, terms, and address normalization.
- This can block location setup and search UX.

Decision needed:

- Pick the MVP provider before implementation starts.
- If fallback is required, define whether provider abstraction is part of MVP or whether switching later is acceptable.

### 4. Launch geography is still ambiguous

The spec says initial launch is "India or another km-based market".

Why this matters:

- Phone validation, default country code, address labels, postal code rules, currency display, legal copy, timezone defaults, and locale formatting depend on country.

Decision needed:

- Choose the first launch country.
- If India is the target, state it directly and set defaults around `IN`, `+91`, INR, km, and applicable privacy baseline.

### 5. Platform admin forced double-booking override conflicts with booking correctness

The spec says tenant admins cannot override double-booking, but platform admins may perform a forced conflict override.

Why this matters:

- This weakens the core invariant "no double bookings".
- It requires special schema/API/UI behavior and support procedures.
- It may create customer-facing confusion if two bookings exist for the same expert and time.

Decision needed:

- Either remove forced double-booking override entirely from MVP, or define exactly:
  - who can use it
  - where it appears
  - whether it creates overlapping confirmed bookings
  - whether affected customers are notified
  - whether it is only for migration/support repair and hidden from normal UI

Recommended decision:

- Do not allow any forced overlapping booking in MVP. Use `requires_admin_review` and manual cancellation instead.

### 6. Manual booking outside availability needs exact slot behavior

Tenant admins can manually create bookings outside normal availability, but not overlapping existing bookings.

Why this matters:

- The UI and API need to know whether manual booking uses generated slots or arbitrary start/end time input.
- It affects validation, audit, and customer notifications.

Decision needed:

- Define whether manual booking outside availability:
  - uses arbitrary start time and service-derived duration, or
  - must still align to the tenant 15-minute slot interval.

## Remaining P1 Gaps

### 7. Booking edit powers are too broad

The spec says platform admins may "view, edit, cancel, or force-review bookings".

Why this matters:

- Editing a booking can mean changing customer PII, notes, service, expert, time, status, or snapshots.
- Some edits should be prohibited to preserve historical integrity.

Decision needed:

- Define exactly which booking fields are editable after creation.
- Recommended:
  - allow notes/status/support metadata edits
  - prohibit direct editing of service/expert/start time
  - model time changes as cancellation plus new booking until rescheduling exists

### 8. `requires_admin_review` operational behavior is incomplete

Suspending a tenant moves future bookings to `requires_admin_review`, but the process after that is only lightly defined.

Why this matters:

- Notifications, tenant visibility, customer expectations, and admin workflow need clear behavior.

Decision needed:

- Define whether customers receive an email when a booking moves to review.
- Define whether reviewed bookings can still occur while tenant is suspended.
- Define who owns the review queue.

### 9. Booking reference format is unspecified

The spec requires short non-sequential reference strings.

Why this matters:

- Format affects collision handling, support UX, and security.

Decision needed:

- Define reference format, for example `BK-7H4K2Q`, 6-8 uppercase base32 characters, globally unique.

### 10. Service auto-assignment rule needs tie-breakers

If the customer does not select an expert, the system assigns the available expert with the earliest slot that matches search context.

Why this matters:

- Multiple experts may have the same earliest slot.
- This affects fairness and repeatability.

Decision needed:

- Define tie-breaker, such as lowest current daily booking count, then alphabetical display name, then UUID.

### 11. Availability override semantics need examples

The spec says override can add special working hours and also replace normal recurring schedule for the specified time range/date.

Why this matters:

- "Add" and "replace" are different behaviors.
- A developer could implement either and pass basic tests.

Decision needed:

- Define whether `override` means:
  - replace the full day schedule, or
  - add/replace only the specified time range.

Recommended decision:

- Use two explicit types: `block` and `special_hours`.

### 12. Rate-limit values are missing

The spec requires rate limiting by IP and endpoint, but no limits are given.

Why this matters:

- Implementation needs concrete limits and lockout behavior for public booking/search APIs.

Decision needed:

- Define default limits for:
  - search
  - slot lookup
  - booking create
  - login
  - password reset

### 13. Email provider is not selected

The spec lists SendGrid, Postmark, or SES.

Why this matters:

- Template APIs, sender configuration, sandbox behavior, webhooks, and retry details differ.

Decision needed:

- Choose one provider for MVP or explicitly abstract it behind an adapter in sprint 1.

### 14. Background job and Redis dependency should be confirmed

The spec recommends BullMQ or equivalent Redis-backed queue.

Why this matters:

- Reminder delivery and retries require a queue.
- Redis hosting becomes part of deployment.

Decision needed:

- Confirm BullMQ + Redis or choose another queue.

### 15. Customer anonymization needs exact fields

The spec requires admin-driven anonymization while retaining booking records.

Why this matters:

- Bookings snapshot customer name/phone/email.
- Customer records and booking snapshots may both contain PII.

Decision needed:

- Define exactly which fields are anonymized on:
  - `customers`
  - `bookings`
  - `notification_logs`
  - `booking_attempt_logs`
  - `audit_logs`

### 16. Logo upload remains conditional

Logo is optional, and upload may be deferred if not implemented in sprint 1.

Why this matters:

- Optional upload still affects storage, validation, admin UI, and public page rendering.

Decision needed:

- For MVP build scope, choose either:
  - no logo upload, use external URL/text-only branding, or
  - implement local/object-storage upload.

### 17. OpenAPI timing is unclear

The spec says OpenAPI is required before implementation is considered complete.

Why this matters:

- API-first versus code-generated OpenAPI changes workflow.

Decision needed:

- Define whether OpenAPI is produced before coding, during implementation from decorators, or after API stabilization.

## Newly Introduced Ambiguities or Risks

1. **Conditional stack choices:** The spec is approved, but still uses recommended/fallback language for stack, maps, email, and queue choices.

2. **Forced overlap exception:** Platform admin forced conflict override introduces a deliberate exception to the system's most important booking invariant.

3. **India or another market:** The launch market is still not a decision. It is an assumption with an alternative.

4. **PostGIS optionality despite radius search:** Radius-based search is MVP, but the geospatial implementation is still optional.

5. **Admin edit breadth:** "Edit bookings" is too broad unless fields and transition rules are constrained.

6. **Availability override language:** Override both "adds" and "replaces" availability depending on the section wording.

## Final Verdict

Version 1.1 answers the majority of the original questions and is significantly better than v1.0.

It is **not yet completely ambiguity-free**. The remaining gaps are not large product gaps, but they are important implementation decisions. Resolve the P0 items before build start, and the P1 items before the relevant module is implemented.

