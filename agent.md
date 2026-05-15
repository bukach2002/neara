# Coding Agent Build Brief

## Project

Build a production-ready MVP for a **multi-tenant appointment booking platform**.

This file is the primary handoff for the coding agent. It summarizes the approved requirements and defines the phased build order.

## Source of Truth

Read these documents before implementation:

1. `doc/07-final-resolved-requirements-v1-1-revision-3.md`
2. `doc/09-final-decisions-addendum.md`

If there is a conflict:

1. `doc/09-final-decisions-addendum.md` wins.
2. `doc/07-final-resolved-requirements-v1-1-revision-3.md` wins over earlier documents.
3. Earlier documents in `doc/` are historical context only.

## MVP Goal

Create a shared customer-facing web app where customers can discover active tenants, view services, find available expert slots, and create instant confirmed bookings without payment.

Tenant admins must be able to manage their tenant profile, services, experts, expert availability, and bookings.

Platform admins must be able to manage tenants, categories, bookings, audit logs, and notification logs.

## Non-Negotiable Guardrails

Do not implement these in MVP:

- Payments
- Real WhatsApp sending
- Customer accounts or customer login
- Expert login or expert self-service
- Branch management UI
- Branch routing logic
- Rescheduling
- Customer self-cancellation
- Group bookings/classes
- Waitlist
- Reviews/ratings
- Coupons/promotions
- Smart recommendations
- Deep analytics
- File attachments
- Sensitive medical records or diagnosis notes

Hard requirements:

- Do not allow double booking.
- Do not expose inactive or suspended tenants publicly.
- Do not use non-timezone-aware booking logic.
- Do not store sensitive medical notes.
- Preserve tenant data isolation everywhere.
- Audit critical admin and booking actions.
- Keep all secrets in environment variables.

## Approved Stack

Use:

- Frontend: Next.js + React + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL 16+ with PostGIS
- ORM: Prisma
- Background jobs: BullMQ + Redis
- Email provider: Mailtrap
- File storage: S3-compatible object storage for tenant logos and expert photos
- API documentation: OpenAPI produced before or alongside implementation

Architecture:

- Modular monolith backend
- One backend API with route namespaces:
  - `/public/*`
  - `/admin/platform/*`
  - `/admin/tenant/*`
- Secure cookie-based sessions for admin web apps
- CSRF protection for admin web app flows
- Public customer booking APIs are anonymous

## Launch Defaults

- Launch geography: India
- UI language: English
- Distance unit: kilometers
- Default radius: 10 km
- Customer phone: required, normalized to E.164, India default country in UI
- Customer identity: guest booking only
- Customer booking lookup: booking reference + phone number
- Slot interval: fixed 15 minutes in MVP
- Minimum notice: 2 hours
- Advance booking window: 30 days
- Time display: tenant timezone
- Reminder: one email 24 hours before appointment, skipped if booking is created less than 24 hours before start

## Core Domain Rules

### Tenant

Tenant statuses:

- `draft`
- `active`
- `inactive`
- `suspended`

Activation requires:

- tenant name
- primary category
- timezone
- address/locality
- latitude and longitude
- one active service
- one active expert
- one active expert-service assignment
- one availability rule for one active expert

Inactive and suspended tenants:

- hidden from search
- hidden from public direct URLs
- recommended public behavior: 404

Tenant slug:

- globally unique
- immutable after activation

Tenant booking reference prefix:

- stored on tenant record
- uppercase alphanumeric
- used in customer-facing booking reference

### Category

MVP category model:

- tenant belongs to one primary category
- services inherit discoverability from tenant category
- service-level categories are out of MVP

### Service

Service rules:

- fixed duration per service
- optional display-only price
- no payment collection
- price is snapshotted onto booking if present
- active/inactive status
- public visibility boolean
- buffers may exist as nullable future fields but must not affect MVP slot generation

### Expert

Experts are profiles, not login users.

Public fields:

- display name
- photo
- short bio
- services offered

Private fields:

- phone
- email
- internal/admin metadata

Inactive experts and inactive services must be ignored by public booking and slot generation.

### Availability

Expert-specific schedules are the source of truth.

Tenant operating hours are informational only and must not drive slot generation.

Availability rule behavior:

- recurring expert working windows define normal availability
- overlapping working periods for the same expert/day must be rejected on save
- block exceptions remove availability
- override exceptions replace the normal recurring schedule for the specified date or date range
- override does not add to the normal schedule

Slot generation order:

1. Start with expert recurring availability.
2. If an override exists for the date, ignore recurring availability and use override windows.
3. Apply block exceptions.
4. Remove slots overlapping existing confirmed bookings.
5. Apply active tenant/service/expert checks.
6. Apply service duration, 2-hour minimum notice, 30-day advance window, and tenant timezone.

DST/timezone:

- store UTC timestamps
- store tenant IANA timezone
- generate slots with timezone-aware library
- do not generate nonexistent local times
- resolve ambiguous local times consistently using the selected timezone library
- snapshot the human-readable local appointment time shown to the user

### Booking

Booking model:

- one customer
- one tenant
- one location
- one service
- one expert
- one slot

Statuses:

- `confirmed`
- `cancelled`
- `completed`
- `no_show`

Allowed transitions:

- `confirmed -> cancelled`
- `confirmed -> completed`
- `confirmed -> no_show`

No pending status in MVP.

No rescheduling in MVP.

No manual tenant-staff booking creation in MVP.

Cancellation permissions:

- tenant admin: yes
- platform admin: yes
- customer: no
- expert: no

Mandatory customer booking fields:

- full name
- mobile number with country code
- selected service
- selected time slot
- assigned expert
- consent checkbox for privacy and booking-related contact

Optional:

- email
- customer note, max 500 characters

Booking reference format:

```text
{TENANT_PREFIX}-{CODE}
```

Example:

```text
NEAR-7A2K
```

Rules:

- `TENANT_PREFIX` comes from tenant DB field.
- `CODE` is 4 uppercase alphanumeric characters.
- booking reference is globally unique.
- regenerate on collision.

Double booking prevention:

- strict, no override in MVP
- booking creation must revalidate slot inside a transaction
- prevent exact duplicate active bookings for same tenant, service, expert, start time, and customer phone
- enforce database-level protection where possible

Auto expert assignment:

- if customer chooses an expert, use that expert if valid and available
- if customer does not choose an expert, find earliest available slot across eligible experts
- if multiple experts are available for the selected slot, assign the expert with the fewest confirmed bookings that day
- if still tied, use deterministic fallback such as display name then UUID

Booking snapshots:

- tenant name
- location name/address
- service name
- service duration
- displayed price if present
- expert display name
- customer name/phone/email
- starts_at
- ends_at
- timezone and display time string

### Search

Use PostgreSQL text search plus trigram matching.

Use PostGIS for radius/proximity search.

Use Google Maps / Places / Geocoding APIs for location capture.

Search inputs:

- keyword
- category
- locality
- radius
- browser geolocation when allowed

Ranking:

1. active tenant requirement
2. category/locality filter match
3. text relevance
4. distance
5. tenant name stable sort

Tenants with no upcoming availability may appear but must show "no slots currently available".

### Notifications

Email only in MVP.

Use Mailtrap.

Required email templates:

- booking confirmation to customer
- booking cancellation to customer
- booking confirmation alert to tenant admin
- 24-hour reminder to customer

Notification behavior:

- booking succeeds even if email fails
- failed email is logged
- delivery retries asynchronously through BullMQ
- retry up to 3 times with exponential backoff
- mark permanently failed after retries are exhausted

WhatsApp:

- foundation only in data model/provider abstraction/logs
- no production sending in MVP

### Uploads

Tenant logo upload and expert photo upload are in MVP.

Rules:

- use S3-compatible object storage
- image files only
- validate MIME type and file size
- store URL/key in DB
- no arbitrary attachments

### Privacy and Anonymization

Compliance target:

- India DPDP baseline
- general GDPR-style privacy principles

Anonymization:

- platform-admin manual anonymization only
- remove or irreversibly mask personal data
- retain non-PII operational booking records

Anonymize:

- customer name, phone, email
- booking customer snapshots
- customer note
- notification recipient and payload PII
- booking attempt PII
- PII inside audit JSON snapshots where practical

Retain:

- booking ID
- booking reference
- tenant ID
- location ID
- service ID
- expert ID
- appointment start/end time
- status
- non-PII operational metrics

## Environment Variables

Create an `.env.example` and document all variables.

Required groups:

- app URLs and environment
- PostgreSQL connection
- Redis connection
- session secret
- CSRF secret if separate
- Mailtrap credentials
- Google Maps API key
- S3-compatible storage credentials
- rate-limit values

Rate-limit values must be read from `.env`, not hardcoded in business logic.

Include these variables:

```text
RATE_LIMIT_PUBLIC_SEARCH_PER_MINUTE=
RATE_LIMIT_PUBLIC_SLOT_LOOKUP_PER_MINUTE=
RATE_LIMIT_PUBLIC_BOOKING_CREATE_PER_MINUTE=
RATE_LIMIT_PUBLIC_BOOKING_LOOKUP_PER_MINUTE=
RATE_LIMIT_ADMIN_LOGIN_PER_WINDOW=
RATE_LIMIT_PASSWORD_RESET_PER_HOUR=
RATE_LIMIT_WINDOW_SECONDS=
```

Provide sensible local-development defaults if env values are missing.

## Required Data Model

Use Prisma schema with UUID primary keys.

Core entities:

- users
- tenant_memberships
- tenants
- categories
- services
- experts
- expert_services
- locations
- availability_rules
- availability_exceptions
- customers
- bookings
- notification_logs
- audit_logs

Recommended additional entities:

- sessions
- password_reset_tokens
- booking_attempt_logs
- uploaded_assets or media table if useful
- notification_templates or template registry

Soft delete/archive fields:

- tenants
- services
- experts
- locations

Do not soft delete bookings.

Uniqueness:

- tenant slug globally unique
- tenant booking prefix should be unique or strongly validated for support clarity
- category slug globally unique
- service name unique per tenant
- booking reference globally unique

## Phased Build Plan

### Phase 0: Repository and Architecture Setup

Goal: establish the project skeleton and local development loop.

Build:

- monorepo or clearly separated `apps/web` and `apps/api`
- Next.js frontend
- NestJS backend
- Prisma setup
- PostgreSQL + PostGIS local setup documentation
- Redis local setup documentation
- shared TypeScript config/lint/format setup
- `.env.example`
- basic health endpoints
- OpenAPI generation path

Acceptance:

- frontend starts locally
- backend starts locally
- database migration command works
- Prisma client generation works
- Redis connection works
- health endpoint returns OK

### Phase 1: Database Schema, Seed Data, and Auth Foundation

Goal: create the persistence foundation and admin authentication.

Build:

- Prisma schema for core entities
- enums for statuses and roles
- migrations
- seed categories, sample tenant, services, experts, availability, admin users
- admin email/password login
- secure cookie sessions
- CSRF protection
- password reset flow for platform and tenant admins
- tenant membership authorization model
- RBAC guards/interceptors
- tenant scoping utilities
- audit logging helper

Acceptance:

- platform admin can log in
- tenant admin can log in
- tenant admin is scoped to their tenant
- password reset works through Mailtrap
- tenant isolation tests pass

### Phase 2: Platform Admin MVP

Goal: allow platform owner to manage platform-level setup.

Build platform admin screens/APIs:

- login/logout
- dashboard shell
- tenant list
- create tenant
- tenant detail/edit
- create first tenant admin
- activate/inactivate/suspend tenant
- category management
- booking lookup by tenant/date/reference
- audit log list
- notification log list

Tenant activation validation:

- enforce activation requirements exactly
- block activation if requirements are missing

Acceptance:

- platform admin can create a draft tenant
- platform admin can create first tenant admin
- platform admin can manage categories
- platform admin can activate only valid tenants
- suspended/inactive tenants are not public
- audit log records critical actions

### Phase 3: Tenant Admin MVP

Goal: allow tenants to configure their booking operation.

Build tenant admin screens/APIs:

- tenant dashboard
- tenant profile
- primary location management with Google geocoding
- logo upload
- service CRUD
- service visibility/active controls
- expert CRUD
- expert photo upload
- expert-service assignment
- expert recurring availability management
- availability block exceptions
- availability override exceptions
- booking list
- booking detail
- cancel booking
- mark completed
- mark no-show

Dashboard metrics:

- bookings today
- upcoming bookings
- confirmed bookings for selected date range
- cancelled bookings for selected date range

Acceptance:

- tenant admin can configure a bookable tenant
- overlapping working periods for same expert/day are rejected
- override replaces normal recurring schedule
- block removes availability
- tenant admin cannot access another tenant's data
- uploads validate file type and size

### Phase 4: Public Discovery and Tenant Pages

Goal: enable customer discovery across active tenants.

Build public screens/APIs:

- homepage/search page
- tenant search results
- keyword search
- category filter
- locality filter
- radius search
- browser geolocation support
- tenant detail page by slug
- service listing
- expert listing/optional expert selection
- no-slots currently available state
- clean URLs and basic metadata

Search implementation:

- PostgreSQL full-text/trigram matching
- PostGIS distance/radius filtering
- ranking order from requirements

Acceptance:

- inactive/suspended tenants return 404 publicly
- active tenants are searchable
- service names are globally searchable
- radius search works in kilometers
- geolocation denial does not block search
- public pages work at 360 px width without horizontal scrolling

### Phase 5: Slot Generation and Booking Core

Goal: implement the critical scheduling and booking transaction path.

Build:

- slot generation service
- public available-slots API
- expert-specific slot lookup
- any-expert slot lookup
- auto expert assignment
- booking creation API
- customer details and consent capture
- booking reference generation
- transactional double-booking prevention
- duplicate booking prevention
- booking confirmation page
- booking lookup by reference + phone
- booking attempt logging for conflicts/validation failures

Critical rules:

- fixed 15-minute increments
- 2-hour minimum notice
- 30-day advance booking window
- tenant timezone display
- UTC storage
- strict no double booking
- no manual booking creation
- no rescheduling

Acceptance:

- customer can book an available slot without login
- booking is instantly confirmed
- booking reference is generated as `{TENANT_PREFIX}-{4_ALPHANUM}`
- same expert/time cannot be double-booked under concurrency
- slot visible but taken by another customer returns clean error
- any-expert flow assigns fewest-confirmed-bookings expert for tied slot
- DST/timezone tests pass

### Phase 6: Notifications and Reminders

Goal: deliver MVP email communication and logs.

Build:

- notification event producer
- BullMQ notification queue
- Mailtrap email adapter
- template rendering
- notification logs
- retry policy: 3 retries, exponential backoff
- booking confirmation email
- booking cancellation email
- tenant admin new-booking alert
- 24-hour reminder scheduler
- WhatsApp provider abstraction and enum/log support only

Acceptance:

- booking confirmation email sends in staging/local Mailtrap
- cancellation email sends
- tenant admin receives new booking alert
- reminders enqueue only when appointment is more than 24 hours away
- failed delivery is logged and retried
- booking still succeeds if email fails

### Phase 7: Privacy, Audit, Security, and Hardening

Goal: make the MVP operationally trustworthy.

Build:

- platform-admin anonymization action
- PII redaction/masking for customer, booking snapshots, notification logs, booking attempts, and audit JSON where practical
- rate limiting from environment variables
- login lockout/progressive throttling
- input validation and sanitization
- consistent error responses
- structured logs
- error tracking integration hook
- queue monitoring basics
- backup/restore documentation
- environment variable reference

Acceptance:

- anonymization removes customer PII while preserving operational records
- rate limits read from `.env`
- login throttling works
- sensitive fields are not leaked in logs
- audit records critical actions
- backup/restore process is documented

### Phase 8: Testing, Documentation, and Launch Readiness

Goal: finish the MVP to definition of done.

Required tests:

- unit tests for scheduling and validation logic
- integration tests for slot generation
- integration tests for availability block and override behavior
- integration tests for booking creation
- concurrency tests for double-book prevention
- permission/RBAC tests
- tenant isolation tests
- API tests for public and admin flows
- end-to-end test for customer booking flow
- regression tests for cancellation flow

Required docs:

- OpenAPI spec
- engineering setup README
- environment variable reference
- admin user guide
- tenant admin quick-start guide
- backup/restore notes

Acceptance:

- all required tests pass
- staging deployment works
- production environment is deployable
- email flow works in staging
- audit and notification logs are visible
- public booking flow passes end to end
- no out-of-scope MVP features are present

## Frontend UX Requirements

Customer app:

- mobile-first
- usable at 360 px width
- no horizontal scrolling
- simple search-led flow
- clear booking CTAs
- low-friction forms
- WCAG 2.1 AA for core booking flow where practical

Admin app:

- usable at 768 px width
- practical, dense, operational UI
- no marketing-style landing pages for admin surfaces
- clear tables, filters, forms, and state badges

Core customer pages:

- search/home
- results
- tenant detail
- service/expert selection
- slot selection
- booking details form
- confirmation page
- booking lookup

Core tenant admin pages:

- login
- dashboard
- tenant profile/location
- service management
- expert management
- availability management
- bookings list
- booking detail

Core platform admin pages:

- login
- tenant list/detail/create
- category management
- booking lookup
- audit logs
- notification logs

## Definition of Done

MVP is done only when:

- all P0 functionality is implemented
- staging environment is deployed
- production environment is deployable
- admin and tenant auth works
- tenant isolation tests pass
- slot generation tests pass
- concurrent booking prevention tests pass
- public booking flow passes end to end
- Mailtrap email notification flow works
- audit logging works for critical actions
- notification logs are visible
- observability hooks are active
- rollback and backup procedures are documented
- no explicitly out-of-scope features are implemented

