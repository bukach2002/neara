# Multi-Tenant Appointment Booking Platform
## Technical Requirements and Resolved Decisions
### Version 1.1
### Status: Approved Working Spec for MVP Build

---

## 1. Document Purpose

This file supersedes unresolved parts of version 1.0 and converts open questions from the technical lead into implementation decisions for MVP.

This version is intended to be handed directly to a development agent.

Primary goals of this version:

- freeze MVP scope
- remove ambiguity that would block architecture and estimation
- define sensible defaults where business decisions were not yet finalized
- minimize rework while keeping the system extensible

---

## 2. MVP Scope Freeze

### 2.1 Exact MVP launch scope

The MVP includes only the following:

- shared customer-facing web app
- multi-tenant platform with shared database
- platform admin panel
- tenant admin panel
- tenant profile setup
- category management
- service management
- expert profile management
- expert availability management by tenant admin
- tenant location setup with geocoded coordinates
- tenant discovery by keyword, category, locality, and radius
- tenant detail pages
- booking flow without payment
- booking confirmation by email
- booking reminder by email
- booking cancellation by email
- booking management by tenant admin
- customer guest booking with booking reference lookup
- audit logging for admin actions
- notification logging
- core reporting/dashboard basics

### 2.2 Explicitly out of scope for MVP

The following are not part of MVP and must not be implemented except where a schema placeholder is explicitly required:

- native mobile apps
- online payment collection
- booking approval workflow
- smart recommendations
- SEO optimization work beyond clean URLs and indexable public pages
- branch management UI
- branch-level booking logic
- online/remote appointments
- service-specific location variations
- group bookings/classes
- expert self-service portal
- WhatsApp sending in production unless credentials and approved templates are already available before build start
- customer accounts and customer login
- customer self-rescheduling
- complex reporting
- file uploads except optional tenant logo if trivially supported

---

## 3. Target Market Decision

### 3.1 First target tenant types

The MVP is optimized for **local appointment-based businesses with one physical service location per tenant**.

Primary initial tenant archetypes:

- salons and beauty services
- wellness and grooming businesses
- consultation-based service businesses

The MVP is **not** optimized for regulated healthcare, emergency services, or high-complexity medical workflows.

### 3.2 Regulatory boundary

The platform must not store protected health information or sensitive medical notes in MVP.
Medical-clinic workflows requiring health-data compliance are out of scope.

---

## 4. Product Positioning Decision

### 4.1 Marketplace vs tenant-page priority

The MVP is **marketplace discovery-first**, with tenant pages also sharable directly.

This means:

- the homepage prioritizes search and discovery across tenants
- every tenant has a public slug page
- tenants may share direct links to their page
- routing must support both discovery-driven and direct-entry booking

---

## 5. Device, Browser, and UX Support

### 5.1 Web-first definition

The MVP must support:

- latest two major versions of Chrome
- latest two major versions of Safari
- latest two major versions of Edge
- latest two major versions of Firefox
- iOS Safari and Android Chrome on current mainstream mobile devices

### 5.2 Minimum screen support

The customer app and admin app must be usable down to **360px width**.

### 5.3 Mobile apps

Native mobile apps are explicitly out of scope for the first production release.

### 5.4 Accessibility

Target accessibility standard for MVP: **WCAG 2.1 AA for core customer flows**.

---

## 6. Identity and Authentication Decisions

### 6.1 Customer identity model for MVP

Customer identity model is:

- **guest booking only**
- no customer login required
- no customer account management in MVP

### 6.2 Booking lookup model

A customer can retrieve a booking using:

- booking reference code
- phone number used at booking

Optional second factor for lookup in MVP:

- one-time email link if email exists

SMS or WhatsApp OTP is not required for MVP.

### 6.3 Unique customer identification

Customer records are not globally unique in MVP.

Rules:

- phone number is required and stored in E.164 format where possible
- email is optional
- phone is **not** globally unique at database level
- email is **not** globally unique at database level
- customer deduplication is best-effort application logic, not a hard database constraint

### 6.4 OTP decision

OTP is not part of MVP authentication.

### 6.5 Admin and expert account invitation

Admin/expert invitation model for MVP:

- platform admin creates the first tenant admin user
- tenant admin can create expert profiles without login access
- no expert invitation flow in MVP
- no expert passwords in MVP unless expert-login phase is later enabled

### 6.6 Multi-tenant user membership

A user may belong to multiple tenants in the data model, but this is **not surfaced in MVP UI** except platform admin.

### 6.7 Role model

Use a **membership-based multi-role model**, not a single `role_id` on user.

Recommended tables:

- `users`
- `tenant_memberships`
- `platform_roles`
- `tenant_roles`

### 6.8 Password reset and account recovery

Required in MVP for platform admins and tenant admins only:

- email/password login
- forgot password by email link
- password reset token expiry 60 minutes

Experts and customers do not need account recovery in MVP because they do not log in.

---

## 7. Tenant Isolation and Visibility Decisions

### 7.1 Tenant isolation strategy

MVP uses:

- **shared PostgreSQL database**
- shared schema
- strict `tenant_id` scoping in application logic and database indexes
- authorization checks on every tenant-owned resource

No schema-per-tenant or database-per-tenant in MVP.

### 7.2 Public cross-tenant visibility

Public data visible across tenants:

- tenant name
- category
- public description
- public location summary
- public service names/descriptions
- expert display name
- expert profile photo if enabled
- expert bio if enabled
- available slots

Not public in MVP:

- expert email
- expert phone
- internal notes
- full audit data
- precise back-office metadata

### 7.3 Tenant suspension behavior

When a tenant is suspended:

- tenant is hidden from search and public pages
- no new bookings can be created
- future bookings remain in database
- existing future bookings move to `requires_admin_review`
- platform admin must decide whether to cancel externally
- no automatic silent deletion or completion of bookings

### 7.4 Data export

Tenant admins may export booking data as CSV in Phase 1.1, not strict MVP blocker.
If time is constrained, defer export and keep API/service design ready.

### 7.5 Slugs

Tenant slugs are:

- globally unique
- editable only by platform admin
- effectively immutable after activation for MVP
- no redirect system required in MVP because slug changes are disallowed post-activation

---

## 8. Tenant Onboarding and Status Lifecycle Decisions

### 8.1 First tenant admin creation

The first tenant admin is created by the platform admin during tenant setup.

### 8.2 Final tenant statuses

Use only these tenant statuses in MVP:

- `draft`
- `active`
- `inactive`
- `suspended`

`pending` is removed from MVP.

### 8.3 Activation requirements

A tenant can be marked `active` only when all of the following exist:

- tenant name
- slug
- at least one assigned category
- timezone
- address and geo-coordinates
- public contact phone
- at least one active service
- at least one active expert
- at least one valid future availability rule for at least one expert

### 8.4 Inactive tenant access

Inactive tenants are hidden from public discovery and direct public URL access in MVP.
Only platform admin and tenant admin can view them in admin areas.

### 8.5 Branding fields

Branding fields in MVP:

- logo optional
- banner excluded
- if uploads are not implemented in sprint 1, use text-only branding and defer logo upload

---

## 9. Category and Service Decisions

### 9.1 Category ownership

Each tenant may belong to multiple categories.
Each service belongs to **one primary category** chosen from platform categories.
Service category does not inherit automatically from tenant.

### 9.2 Price display

Service price field exists in schema but is optional.
If provided, it is displayed as informational only.
No payment collection or deposit logic in MVP.

### 9.3 Service duration

Service duration is fixed per service in MVP.
Expert-specific service durations are out of scope.

### 9.4 Buffers

Buffer before/after is excluded from MVP scheduling logic.
Fields may exist in schema but must not affect slot generation in MVP.

### 9.5 Expert optionality

A service may be booked without customer manually selecting a specific expert.
System behavior:

- customer selects service first
- customer may optionally select an expert
- if no expert selected, system assigns the available expert with the earliest slot that matches search context

### 9.6 Hidden services

Services support:

- `active`
- `inactive`
- `internal_only`

`internal_only` services are visible to tenant admins only and cannot be booked publicly.

### 9.7 Group bookings

Not in MVP.
The MVP booking model is strictly:

- one customer
- one tenant
- one service
- one expert
- one slot

---

## 10. Expert Management Decisions

### 10.1 Experts as users

Experts are not required to be system users in MVP.
An expert is primarily a scheduling/resource profile.

### 10.2 Expert self-management

Experts do not manage their own availability in MVP.
All availability is managed by tenant admin.

### 10.3 Multiple experts per appointment

Not supported in MVP.
Each booking references exactly one expert.

### 10.4 Public expert profile fields

Public expert fields:

- display name
- profile photo optional
- short bio optional
- services offered

Private only:

- email
- phone
- internal notes

### 10.5 Assignment validation

Rules:

- inactive services cannot be publicly booked
- inactive experts cannot be publicly booked
- assignment between expert and inactive service may exist in database but is ignored by booking/search

---

## 11. Availability and Scheduling Decisions

### 11.1 Canonical availability model

MVP uses **expert-specific schedules** as the canonical availability source.
Tenant operating hours are informational only and are used only to guide setup, not slot generation.

### 11.2 Slot interval

Default slot interval is **15 minutes**.
This is a tenant-level configurable field in schema, but for MVP UI use only 15-minute intervals unless later enabled.

### 11.3 Overlapping rules

Rules:

- multiple availability windows on the same day are allowed
- overlapping working windows are merged into a normalized availability set
- blocks and exceptions take precedence over recurring availability
- overrides can add special working hours on a specific date

### 11.4 Exception types

Availability exceptions in MVP support:

- `block` = remove availability
- `override` = replace normal recurring schedule for the specified time range/date

`leave` is represented as `block` with a reason.

### 11.5 Minimum notice default

Default minimum notice: **2 hours**.
Tenant-configurable later, but hard default for MVP is 2 hours.

### 11.6 Advance booking window default

Default advance booking window: **30 days**.

### 11.7 Timezone display

In MVP, customers see all appointment times in the **tenant timezone**.
Optional UI note may show timezone abbreviation.
Customer-local timezone conversion is out of scope.

### 11.8 DST handling

Rules:

- store all booking timestamps in UTC
- store tenant timezone IANA identifier
- generate slots using tenant local timezone rules
- on DST transition days, invalid local times must not be generated
- ambiguous repeated times must be normalized using timezone library rules and stored as precise UTC instants

### 11.9 Stored end time

Booking end time must be derived at booking creation and stored as a snapshot.

### 11.10 Manual bookings outside availability

Tenant admins may manually create bookings outside normal availability in MVP, but:

- it must require an explicit override action
- it must still prevent overlap with existing bookings unless platform admin override exists
- override reason must be audit logged

### 11.11 Double-booking override

Tenant admins cannot override double-booking prevention in MVP.
Only platform admins may perform a forced conflict override through a restricted admin action, and every such action must require a reason and audit log.

---

## 12. Booking Lifecycle Decisions

### 12.1 Booking confirmation model

Booking confirmation is always **instant confirmed** in MVP.

### 12.2 Booking statuses

Use these statuses only:

- `confirmed`
- `cancelled`
- `completed`
- `no_show`
- `requires_admin_review` (exception state only, not normal booking flow)

`pending` is removed from standard MVP booking flow.

### 12.3 Allowed transitions

Allowed status transitions:

- `confirmed -> cancelled`
- `confirmed -> completed`
- `confirmed -> no_show`
- `confirmed -> requires_admin_review`
- `requires_admin_review -> cancelled`
- `requires_admin_review -> confirmed`

No other transitions are allowed.

### 12.4 Cancellation permissions

MVP cancellation rights:

- tenant admin: yes
- platform admin: yes
- customer: no self-service cancellation in MVP UI
- expert: no

### 12.5 Rescheduling

Not in MVP.
Rescheduling is future scope.

### 12.6 Mandatory booking fields

Required at booking:

- customer full name
- mobile number with country code
- acceptance of privacy and communication consent checkbox

Optional at booking:

- email
- customer note

### 12.7 Booking reference

Every booking must have a customer-facing booking reference code.
Use short non-sequential reference strings suitable for support lookup.

### 12.8 Duplicate booking prevention

Prevent duplicate active bookings where all of the following match:

- same tenant
- same service
- same expert
- same start time
- same customer phone
- status is active/confirmed

### 12.9 Customer notes

Customer notes are allowed and visible to tenant admins.
They are visible to experts only if expert UI is later enabled.
No sensitive data should be requested in note copy.

### 12.10 Notification failure behavior

If booking succeeds and notification fails:

- booking remains confirmed
- notification failure is logged
- system retries asynchronously
- admin UI may show failed notification status
- customer sees booking confirmation page regardless

### 12.11 Consent

Booking creation requires explicit checkbox consent for:

- privacy policy
- booking-related communications

---

## 13. Search and Discovery Decisions

### 13.1 Search engine choice

Use PostgreSQL search for MVP:

- trigram index for fuzzy text matching
- full-text search where helpful
- no external search engine in MVP

### 13.2 Map and geocoding provider

Use **Google Maps Platform** for MVP if budget and keys are available.
Fallback option if cost blocks launch: Mapbox.
Do not use free Nominatim for production operational dependency.

### 13.3 User location capture

Supported inputs for MVP:

- browser geolocation prompt if user allows
- manual locality/city search
- manual postcode entry if applicable to launch geography

### 13.4 Default radius

Default radius: **10 km**.

### 13.5 Distance unit

Use **kilometers** in MVP.

### 13.6 Launch geography

Initial launch geography assumption: **single-country rollout in India or another km-based market**.
To keep build neutral:

- country is configurable per tenant
- phone numbers stored with country code
- address model remains internationalized

### 13.7 Ranking precedence

Search ranking order for MVP:

1. tenant active status
2. text relevance
3. distance
4. availability presence
5. stable alphabetical tie-breaker

### 13.8 No-availability tenants

Tenants with no upcoming availability may appear in search results but must be visually marked as unavailable.
They rank below tenants with availability when other relevance factors are similar.

### 13.9 Global service search

Service names are searchable globally in MVP.
Search can return tenants because of service-name matches.

### 13.10 SEO

No dedicated SEO work is required in MVP beyond:

- unique tenant slugs
- server-renderable or crawlable public tenant pages if architecture allows
- proper page titles and meta descriptions if easy to implement

---

## 14. Location and Future Branch Decisions

### 14.1 Branch entity decision

Do **not** implement full branch support in MVP.
However, implement a reusable `locations` table now.

### 14.2 Migration protection

To reduce future migration risk:

- tenants reference a primary `location_id`
- bookings snapshot location details
- services may later reference location availability, but not in MVP

### 14.3 Service-specific locations

Not supported in MVP.

### 14.4 Online appointments

Not supported in MVP.
All appointments are on-site at tenant primary location.

---

## 15. Notifications and WhatsApp Decisions

### 15.1 Day-one channels

Required day-one notification channel:

- email

### 15.2 WhatsApp decision

For MVP, implement **WhatsApp foundation only**, not mandatory live sending.
Foundation includes:

- template registry table
- channel enum support
- delivery log support
- provider abstraction

Production WhatsApp sending is enabled only if:

- WABA is configured
- approved templates exist
- integration is tested before release

### 15.3 WABA ownership

Platform owner is responsible for Meta WABA setup and template approval.
Tenants do not own separate WABA accounts in MVP.

### 15.4 Required MVP templates

Email templates required:

- booking confirmation to customer
- booking cancellation to customer
- booking reminder to customer
- new booking alert to tenant admin

Optional if enabled:

- WhatsApp customer confirmation
- WhatsApp reminder

### 15.5 Template customization

Tenants cannot freely customize templates in MVP.
They may optionally configure limited placeholders like business signoff or support phone if that is easy.

### 15.6 WhatsApp opt-in

If WhatsApp is enabled later, customer opt-in checkbox must be collected at booking time where legally required.
For MVP email only, general communication consent is sufficient.

### 15.7 Reminder timing

Default reminder timing: **24 hours before appointment**.
If appointment is booked less than 24 hours ahead, do not send the 24-hour reminder.
No 1-hour reminder in MVP.

### 15.8 Staff notifications

Tenant admins receive new booking email notifications.
Experts do not receive notifications in MVP.

### 15.9 Retry policy

Notification retry policy:

- up to 3 retries
- exponential backoff
- final status logged as failed if retries exhausted

---

## 16. Admin, Reporting, and Audit Decisions

### 16.1 Mandatory platform admin screens

Required MVP platform admin screens:

- tenant list
- tenant detail/edit
- category management
- tenant activation/suspension
- booking list with tenant filter
- booking detail view
- platform dashboard summary
- audit log list
- notification log list

No deep integration management UI required in MVP.

### 16.2 Mandatory tenant dashboard metrics

Required tenant dashboard metrics:

- bookings today
- upcoming bookings next 7 days
- confirmed bookings count
- cancelled bookings count
- completed bookings count
- experts with availability today

### 16.3 Audit log detail

Audit logs must store:

- actor user ID
- actor role
- tenant ID if applicable
- entity type
- entity ID
- action
- timestamp
- summary of changed fields
- before snapshot JSON for sensitive admin actions
- after snapshot JSON for sensitive admin actions
- optional reason field
- request IP and user agent where available

### 16.4 Retention

Retention defaults for MVP:

- audit logs: 12 months minimum
- notification logs: 6 months minimum

### 16.5 Audit log visibility

Audit logs visible to:

- platform admins across all tenants
- tenant admins only for actions within their tenant, excluding platform-only security events

---

## 17. Data Model Decisions

### 17.1 Database

Use **PostgreSQL**.
Use **PostGIS** if geospatial querying is needed in implementation; otherwise basic lat/lng with indexed distance calculations is acceptable for MVP.

### 17.2 IDs

Use **UUIDs** for primary keys on all core entities.
Customer-facing booking references must be separate short codes.

### 17.3 Soft delete

Use soft delete for:

- tenants
- services
- experts
- locations

Do not soft delete bookings.
Bookings remain immutable historical records and use statuses instead.

### 17.4 Uniqueness constraints

Required uniqueness constraints:

- tenant slug globally unique
- category slug globally unique
- service name unique per tenant among non-deleted services
- expert display name not unique
- expert email not required unique in MVP
- location records no uniqueness requirement
- booking reference globally unique

### 17.5 Booking snapshots

Bookings must snapshot at creation time:

- tenant name
- location display text
- service name
- service duration
- displayed service price if present
- expert display name
- timezone

### 17.6 Location entity

`Location` must be a real entity in MVP.
Do not store location only as flat tenant columns.
Recommended:

- `tenants.primary_location_id`
- `locations` table with reusable address/geo fields

### 17.7 Roles model

Roles should be implemented as enums plus membership tables, not as a standalone generic roles table unless the chosen framework requires one.

### 17.8 Availability rule effective dates

Availability rules should support optional `effective_from` and `effective_to` dates in MVP schema.
UI may expose only the simple recurring pattern at first.

### 17.9 Phone normalization

Phone numbers should be normalized to **E.164** where possible before storage.
Also store raw input for troubleshooting if useful.

---

## 18. API and Integration Decisions

### 18.1 Stack selection

Recommended default stack for MVP:

- backend: Node.js with NestJS or Express
- frontend: Next.js web app
- database: PostgreSQL
- background jobs: BullMQ or equivalent Redis-backed queue
- email: transactional provider such as SendGrid, Postmark, or SES

If the team already has a stronger standard stack, that standard may override framework choice, but all API and schema decisions in this document still apply.

### 18.2 API organization

Use one backend application with route namespaces:

- `/public/*`
- `/tenant-admin/*`
- `/platform-admin/*`

No need for separate deployed services in MVP.

### 18.3 Auth method

Use secure cookie-based sessions for admin web apps.
Public customer flow is anonymous/guest.
JWT is not required in MVP unless team tooling strongly prefers it.

### 18.4 Rate limiting

Public APIs must be rate-limited by IP and endpoint.
Admin auth routes must also be rate-limited.

### 18.5 Notification APIs

Notifications should be triggered from domain events and background jobs, not exposed as public APIs.

### 18.6 API contract

An OpenAPI specification is required before implementation is considered complete.

---

## 19. Security, Privacy, and Compliance Decisions

### 19.1 Privacy regime

MVP must be designed to satisfy a **general privacy baseline aligned with GDPR/UK GDPR principles**:

- purpose limitation
- minimal collection
- consent capture
- deletion/anonymization workflow
- access control
- auditability

### 19.2 Sensitive data restriction

Sensitive health data is out of scope.
Do not store clinical notes or medical records.
Customer note fields must warn against entering sensitive personal data.

### 19.3 Consent text requirement

Before launch, legal/privacy text must be supplied for:

- privacy policy
- booking communication consent

Implementation must include placeholders and checkbox capture.

### 19.4 Deletion/anonymization

MVP must support admin-driven anonymization of customer PII on request, while retaining booking records for operational reporting.

### 19.5 Two-factor authentication

2FA is not required for MVP launch.
It should be planned for platform admins in a later phase.

### 19.6 Login throttling

Failed login policy:

- rate limit repeated attempts
- temporary lock after 10 failed attempts within 15 minutes
- lock duration 15 minutes

### 19.7 Upload moderation

If logo upload is implemented, only allow image MIME types and size validation.
No advanced moderation or antivirus scanning required for MVP.

### 19.8 Secrets management

Use environment-managed secrets in hosted infrastructure.
Do not hardcode secrets.
Use a managed secret store if available in deployment platform.

---

## 20. Non-Functional Requirements

### 20.1 MVP scale targets

Design for initial scale of:

- up to 500 tenants
- up to 50 experts per tenant
- up to 20,000 bookings per day platform-wide
- up to 200 concurrent booking users
- up to 100 search requests per minute sustained

### 20.2 Response-time targets

Target p95 response times:

- search API: under 800 ms
- tenant detail API: under 500 ms
- slot lookup API: under 1000 ms
- booking confirmation API: under 1500 ms excluding email delivery

### 20.3 Availability target

MVP uptime target: **99.5% monthly**.

### 20.4 Backup and restore

Requirements:

- daily automated database backups
- point-in-time recovery preferred if supported
- restore test at least once before launch

### 20.5 Observability

Required observability:

- structured application logs
- error monitoring
- queue job monitoring
- booking and slot-conflict metrics
- basic uptime alerting

### 20.6 Environments

Required environments:

- local
- development
- staging
- production

Demo environment optional.

---

## 21. UI and UX Decisions

### 21.1 Brand/design guidance

No formal brand system exists yet.
Use a clean neutral UI with clear booking CTAs and minimal form friction.

### 21.2 Customer booking path

Default public flow:

1. search/browse tenants
2. open tenant page
3. select service
4. optionally select expert or choose earliest available
5. choose date/time slot
6. enter customer details
7. confirm booking
8. view confirmation page with reference code

### 21.3 Book from search results

Users should not fully book directly from search results in MVP.
They must first enter the tenant detail page.
Search cards may include a “Book now” CTA that routes to the tenant page.

### 21.4 Tenant admin calendar view

Required views for MVP:

- list view of bookings
- day view calendar

Week/month views are optional.

### 21.5 Expert UI

Separate expert UI is out of scope for MVP.

### 21.6 Languages/locales

MVP supports English only.

---

## 22. Operations and Support Decisions

### 22.1 Customer support ownership

Primary booking support is handled by the tenant.
Platform support handles platform-level incidents and admin escalations.

### 22.2 Platform admin booking powers

Platform admins may view, edit, cancel, or force-review bookings when needed for support or compliance reasons.
All such actions must be audit logged.

### 22.3 Internal notes

Tenant admins may store internal booking notes visible only to staff/admin users.
Customer notes and internal notes must be separate fields.

### 22.4 Failed booking/conflict logs

Slot conflicts and failed booking attempts must be logged with enough metadata for support troubleshooting.
Do not log unnecessary customer-sensitive content.

### 22.5 Manual booking creation

Tenant admins can manually create bookings in MVP.
This is required.

---

## 23. Quality, Testing, and Definition of Done

### 23.1 Definition of done for MVP

MVP is done only when all of the following are complete:

- all core functional acceptance criteria pass
- staging deployment is available
- production environment is configured
- database migrations are repeatable
- backup and restore process is verified
- error monitoring is enabled
- audit logging is enabled
- notification logs are visible in admin
- legal consent text placeholders exist
- platform admin can activate/deactivate tenants
- tenant admin can manage services, experts, availability, and bookings
- guest customer can complete an end-to-end booking flow
- concurrency protection has been tested
- basic support documentation exists

### 23.2 Required automated tests

Required before launch:

- unit tests for booking domain logic
- integration tests for slot generation
- integration tests for availability exceptions
- permission/RBAC tests
- tenant isolation tests
- API tests for public and admin flows
- end-to-end tests for booking flow
- concurrency test for double-booking prevention

### 23.3 Seed/demo data

Seed/demo data should be provided for local and staging environments.

### 23.4 Documentation deliverables

Required documentation before launch:

- developer setup guide
- API docs or OpenAPI spec
- tenant admin usage guide
- platform admin usage guide

---

## 24. Resolved Specification Corrections from v1.0

The following issues in version 1.0 are formally resolved by this version:

1. encoding must be normalized to UTF-8
2. tenant status set is frozen to `draft`, `active`, `inactive`, `suspended`
3. customer identity is guest booking plus booking reference lookup
4. branches are not implemented, but `locations` is implemented now
5. WhatsApp is foundation-only unless production setup is ready
6. experts are not login users in MVP
7. `pending` is removed from normal booking flow
8. expert-specific availability is canonical; tenant hours are informational
9. `locations` becomes a real entity
10. privacy baseline and data restrictions are now explicit
11. recommended technical stack and infra defaults are chosen
12. NFRs now have measurable targets

---

## 25. Recommended Core Schema Summary

Minimum core entities for MVP:

- `users`
- `platform_admin_memberships` or platform role mapping
- `tenant_memberships`
- `tenants`
- `categories`
- `tenant_categories`
- `locations`
- `services`
- `experts`
- `expert_services`
- `availability_rules`
- `availability_exceptions`
- `customers`
- `bookings`
- `notification_logs`
- `audit_logs`
- `booking_attempt_logs`

---

## 26. Implementation Defaults the Development Agent Should Follow

If any non-critical detail is still unspecified during implementation, apply these defaults:

- prefer simple web UX over optional complexity
- keep all times stored in UTC and displayed in tenant timezone
- use 15-minute slot increments
- use 2-hour minimum notice and 30-day advance booking window
- do not add customer accounts, branches, payments, or expert login to MVP
- make manual tenant-admin booking creation available
- snapshot mutable business data into bookings
- keep search/database architecture simple and PostgreSQL-first
- use background jobs for notifications and reminder delivery
- make all privileged overrides auditable

---

## 27. Final Instruction to Development Agent

Treat this document as the implementation baseline for MVP estimation and build.
Do not expand scope beyond what is explicitly listed as MVP.
When trade-offs arise, choose the option that:

1. preserves booking correctness
2. preserves tenant data isolation
3. preserves auditability
4. reduces operational risk
5. avoids adding customer-facing complexity

