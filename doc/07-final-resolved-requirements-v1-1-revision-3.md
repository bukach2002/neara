# Multi-Tenant Appointment Booking Platform
## Technical Requirements — Resolved Decisions Addendum
### Version 1.1
### Status: Approved Implementation Defaults for MVP
### Supersedes: v1.0 where conflicts exist

## Purpose of this document

This addendum resolves the open questions raised by the tech lead and defines the **final implementation defaults for MVP**.  
Where this document conflicts with v1.0, **this v1.1 addendum takes precedence**.

The goal is to remove ambiguity so a development agent can begin implementation without blocking on product clarifications.

---

# 1. Final MVP Decision Summary

## 1.1 Exact MVP launch scope

The **production MVP** includes only the following:

- Shared customer-facing web app
- Tenant discovery across all active tenants
- Search by keyword, category, locality, and radius
- Tenant public page
- Service listing
- Optional expert selection
- Expert availability and slot generation
- Booking without payment
- Instant booking confirmation
- Tenant admin portal
- Service management
- Expert profile management
- Expert schedule management by tenant admin
- Booking management for tenant admin
- Platform admin portal with essential controls
- Email notifications on booking creation and cancellation
- Notification event and WhatsApp foundation in data model only
- Audit logs for critical admin and booking actions

## 1.2 Explicitly out of scope for MVP

The first production release must **not** implement the following beyond schema-safe preparation where noted:

- Online payments
- Real WhatsApp sending
- Branch management UI
- Branch routing logic
- SEO optimization work beyond clean public URLs and metadata basics
- Native mobile apps
- Expert self-service portal
- Smart recommendations
- Waitlist
- Group bookings
- Rescheduling
- Customer accounts/history dashboard
- Tenant template customization
- File attachments
- Reviews/ratings
- Coupons/promotions
- Deep analytics

## 1.3 Launch market and business scope

MVP targets **local appointment-based service businesses**, with primary fit for:

- salons and beauty services
- wellness/spa services
- clinics and non-emergency consultation businesses
- consultants and coaching businesses

The system should remain category-flexible, but MVP behavior is optimized for:

- one customer
- one service
- one expert
- one physical location
- one appointment slot

Home services, multi-location routing, online meetings, and class-style bookings are out of MVP.

## 1.4 Product posture

The MVP is **marketplace discovery-first with tenant-page booking support**.

This means:

- the shared homepage and search experience are first-class
- every tenant also has a direct public page with a unique slug
- tenants can share their direct page URL externally
- booking can start either from marketplace search or direct tenant link

---

# 2. Device, Browser, and UX Decisions

## 2.1 Web-first definition

"Simple web-first MVP" means:

- responsive web application only
- no native iOS or Android apps in MVP
- optimized for modern mobile browsers first, then desktop
- touch-friendly layouts and controls

## 2.2 Supported browsers

Support the latest two stable versions of:

- Chrome
- Safari
- Edge
- Firefox

## 2.3 Minimum mobile viewport

Minimum supported width for customer booking flows:

- **360 px width**

Minimum supported width for admin screens:

- **768 px width**

## 2.4 Mobile acceptance

Customer booking must be fully usable on mobile web without horizontal scrolling on common mobile devices.

---

# 3. Identity and Authentication Decisions

## 3.1 Customer identity model for MVP

MVP uses **guest booking with phone number plus booking reference**.

Customer account login is out of MVP.

## 3.2 Is login required before booking?

No. Customer login is **not required** before booking.

## 3.3 How customers access existing bookings

Customers access existing bookings using:

- booking reference code
- phone number used during booking

This lookup flow may show booking status and booking details.

## 3.4 Customer unique identifier rules

For MVP:

- phone number is required
- phone numbers must be stored in **E.164 normalized format**
- phone number is **not globally unique**
- email is optional
- email is **not unique**

Reason: a single phone number may legitimately be used for multiple people or family bookings in MVP.

## 3.5 OTP decision

OTP is **not part of MVP customer booking flow**.

Because guest booking is selected, OTP is deferred.

## 3.6 Admin and expert account invitation

For MVP:

- platform admin creates the initial tenant admin user
- tenant admins create expert profiles
- expert profiles do **not** require login accounts in MVP
- expert login/invitations are deferred

## 3.7 Multi-tenant membership

Yes. A user may belong to multiple tenants in the long-term design.

MVP backend must support this through membership mapping, even if UI for switching tenants is basic.

## 3.8 Role model

Use **multi-role capable authorization design**.

Implementation decision:

- `users` table for identities
- `tenant_memberships` table for tenant-scoped roles
- platform role stored separately or in membership model with null tenant scope

Do **not** use a single rigid `role_id` on `users` as the only authorization model.

## 3.9 Password reset and recovery

Required in MVP for platform admin and tenant admin users:

- email/password login
- forgot password via email reset link
- password reset token expiration
- forced logout of old sessions after password reset

Expert password reset is not needed in MVP because expert login is out of scope.

---

# 4. Tenancy and Data Isolation Decisions

## 4.1 Tenant isolation strategy

Use a **shared PostgreSQL database** with strict row-level tenant scoping in the application layer.

Rules:

- every tenant-owned table must include `tenant_id`
- all tenant admin queries must be scoped by `tenant_id`
- all write paths must validate tenant ownership
- platform admin may access all tenants

Schema-per-tenant and database-per-tenant are out of MVP.

## 4.2 Public data visibility

Publicly visible in MVP:

- tenant name
- tenant public description
- category
- locality/city
- approximate address or full business address
- map pin
- service names and descriptions
- service duration
- service displayed price if configured
- expert display name
- expert photo if uploaded
- expert short bio if configured

Not public in MVP:

- expert personal phone
- expert personal email
- internal notes
- audit logs
- raw admin data

## 4.3 Suspended or deactivated tenant booking behavior

If a tenant is suspended or deactivated:

- tenant is removed from public search and public booking
- future bookings remain stored
- bookings are **not** auto-cancelled by system
- platform admin must review and decide operational handling
- tenant admin loses access when suspended
- platform admin may cancel bookings manually if required

## 4.4 Data export

Tenant data export is **not required in MVP**.

## 4.5 Tenant slug rules

Tenant slugs must be:

- globally unique
- immutable after activation in MVP

No redirect logic is required because slug changes are disallowed in MVP.

---

# 5. Tenant Onboarding and Status Lifecycle Decisions

## 5.1 First tenant admin creation

Platform admin creates:

- tenant record
- first tenant admin user
- temporary password or reset-email flow

## 5.2 Final tenant status lifecycle

Final allowed tenant statuses for MVP:

- `draft`
- `active`
- `inactive`
- `suspended`

`pending` is removed from MVP.

## 5.3 Minimum activation requirements for tenant

A tenant may be activated only if all of the following are present:

- tenant name
- category
- timezone
- address/locality
- latitude and longitude
- at least one active service
- at least one active expert
- at least one active expert-service assignment
- at least one availability rule for at least one active expert

## 5.4 Inactive tenant accessibility

Inactive tenants:

- are hidden from search
- are hidden from public direct URLs
- return a not-available public page state or 404 depending on implementation preference

Recommended MVP behavior: return 404 for inactive and suspended public tenant pages.

## 5.5 Branding fields

Logo upload is optional in MVP.  
Banner upload is out of MVP.

---

# 6. Categories and Services Decisions

## 6.1 Category model

For MVP:

- tenant belongs to one primary category
- service does **not** belong to its own separate categories
- services inherit discoverability via tenant category

## 6.2 Service price display

Price display is **allowed** in MVP.

Rules:

- price is optional
- price is display-only
- no payment collection
- price is snapshotted onto booking if present at booking time

## 6.3 Service duration model

Service duration is fixed **per service** in MVP.

Expert-specific duration overrides are out of MVP.

## 6.4 Buffers

Buffers before and after appointments are **out of MVP scheduling logic**.

Fields may exist as future-ready nullable columns, but they must not affect slot generation in MVP.

## 6.5 Optional expert selection

Yes. A service can be booked without manually selecting an expert.

MVP behavior:

- if customer selects an expert, show that expert's slots
- if customer does not select an expert, system returns earliest available slot across eligible experts
- upon booking, system assigns the specific expert for that slot

## 6.6 Hidden services

Yes. Services support:

- active/inactive status
- public visibility boolean

A service may be active operationally but hidden from public booking until published.

## 6.7 Group bookings

Out of scope.  
MVP is strictly:

- one customer
- one service
- one expert
- one time slot

---

# 7. Expert Management Decisions

## 7.1 Are experts always users?

No. In MVP, experts are **profiles**, not system users by default.

## 7.2 Can experts manage their own availability?

No. In MVP, only tenant admins manage expert availability.

## 7.3 Multi-expert appointments

Out of scope for MVP.

## 7.4 Public expert profile fields

Publicly visible expert fields in MVP:

- display name
- photo optional
- short bio optional
- services offered

Not public:

- personal phone
- personal email
- internal notes
- login status

## 7.5 Inactive assignment rules

Validation rules:

- inactive services cannot be booked
- inactive experts cannot be booked
- expert-service assignments may remain stored when either side becomes inactive
- slot generation must ignore inactive experts and inactive services

---

# 8. Availability and Scheduling Decisions

## 8.1 Canonical availability model

MVP uses **expert-specific schedules** as the source of truth.

Tenant operating hours are informational only in MVP and do not drive slot generation.

## 8.2 Slot interval

Default slot interval:

- **15 minutes**

Implementation:

- tenant-configurable later
- fixed globally at 15 minutes in MVP

## 8.3 Overlapping availability rules

Rules:

- multiple working periods on the same day are allowed
- overlapping working periods for the same expert/day must be rejected on save
- block exceptions override working rules
- explicit working-hour override exceptions may add availability for a specific date

## 8.4 Availability exception types

MVP supports these exception types:

- `block` — removes availability
- `override` — replaces the normal schedule for a specific date or range

`leave` can be stored as a block with reason text, not a separate behavioral type.

## 8.5 Minimum notice default

Default minimum notice:

- **2 hours**

## 8.6 Advance booking window default

Default advance booking window:

- **30 days**

## 8.7 Timezone display rule

In MVP, customers see appointment times in the **tenant timezone**.

Optionally, UI may also show a small note for detected customer-local timezone later, but it is not required.

## 8.8 DST handling

All booking times must be stored in UTC and calculated using the tenant IANA timezone.

Rules:

- slot generation must use timezone-aware libraries
- nonexistent local times during DST forward shifts must not be offered
- ambiguous local times during DST backward shifts must resolve consistently using timezone-aware datetime conversion
- booking confirmations must snapshot the human-readable local appointment time string shown to the user

## 8.9 End time storage

Yes. `ends_at` must be derived at booking time and stored as a snapshot.

## 8.10 Manual booking outside normal availability

Not required in MVP.

Tenant admins cannot create bookings outside normal availability because manual booking creation is out of MVP.

## 8.11 Double-booking override

No override allowed in MVP.

Double-booking prevention is strict.

---

# 9. Booking Flow and Lifecycle Decisions

## 9.1 Booking confirmation model

All valid customer bookings are **instantly confirmed** in MVP.

## 9.2 Booking statuses

Final MVP statuses:

- `confirmed`
- `cancelled`
- `completed`
- `no_show`

`pending` is removed from MVP.

## 9.3 Allowed booking transitions

Allowed transitions:

- `confirmed -> cancelled`
- `confirmed -> completed`
- `confirmed -> no_show`

No other status transitions are allowed in MVP.

## 9.4 Who can cancel bookings?

MVP cancellation permissions:

- tenant admin: yes
- platform admin: yes
- customer: no self-cancel in MVP
- expert: no

## 9.5 Rescheduling

Out of MVP.

## 9.6 Mandatory booking fields

Required:

- customer full name
- customer mobile number with country code
- selected service
- selected time slot
- assigned expert

Optional:

- email
- customer note

## 9.7 Booking reference code

Yes. Every booking must have a human-friendly booking reference code.

## 9.8 Duplicate booking prevention

Yes. Prevent exact duplicate active bookings for the same:

- tenant
- service
- expert
- start time
- customer phone

## 9.9 Customer notes

Allowed in MVP.

Rules:

- optional free-text field
- visible to tenant admin
- visible to experts only if expert UI is added later
- maximum length should be constrained, e.g. 500 characters

## 9.10 Notification failure behavior

If booking succeeds but notification fails:

- booking remains valid
- booking API returns success
- failure is logged in notification log
- system retries via background job
- tenant admin may still see the booking immediately

## 9.11 Consent capture

Yes. Booking form must include required consent checkbox text for:

- privacy policy
- contact regarding the booking

Marketing consent is not required in MVP.

---

# 10. Search and Discovery Decisions

## 10.1 Search engine choice

MVP search uses **PostgreSQL text search plus trigram matching**.

No external search engine in MVP.

## 10.2 Map and geocoding provider

Recommended MVP choice:

- **Google Maps / Places / Geocoding APIs**

Reason: operational reliability and admin familiarity.

If cost constraints are severe, this can be swapped later, but the default implementation decision is Google Maps.

## 10.3 User location capture

Customer search supports both:

- manual locality search
- browser geolocation prompt

Geolocation is optional and must never block search.

## 10.4 Default radius

Default radius:

- **10 km**

## 10.5 Distance unit

Default unit for MVP:

- **kilometers**

## 10.6 Launch geography

Default launch assumption:

- **single-country launch in India**

Implications:

- kilometers
- E.164 phone normalization with India as default country in UI
- English UI only in MVP
- tenant timezone selected explicitly during onboarding

## 10.7 Ranking precedence

Ranking order in MVP:

1. active tenant requirement
2. category/locality filter match
3. text relevance
4. distance
5. stable fallback sort by tenant name

## 10.8 Tenants without upcoming availability

Yes, they may still appear in search results if active.

Public UI should show:

- available / no slots currently available

## 10.9 Global service search

Yes. Service names must be searchable globally across tenants in MVP.

## 10.10 SEO

Advanced SEO is out of MVP.  
Only basic clean URLs, page titles, and metadata are required.

---

# 11. Location and Future Branch Decisions

## 11.1 Branch table

Do **not** implement full branch support in MVP.

## 11.2 Future migration protection

Implement a separate `locations` table in MVP, even though only one location per tenant is supported initially.

Rules:

- each tenant has exactly one active location in MVP
- services and bookings reference `location_id`
- this reduces future migration pain for branches

## 11.3 Service-specific locations

Out of MVP.

## 11.4 Online appointments

Out of MVP.

---

# 12. Notifications and WhatsApp Decisions

## 12.1 Required day-one channels

Required channel in MVP:

- **email**

## 12.2 WhatsApp requirement

WhatsApp sending is **not required in MVP launch**.

Only foundation is required:

- notification event model
- provider abstraction
- template identifiers
- message log schema

## 12.3 WABA ownership

Platform team owns:

- Meta WABA setup
- sender identity
- template approval

This is not a tenant responsibility in MVP.

## 12.4 Required MVP templates

Required email templates:

- booking confirmation to customer
- booking cancellation to customer
- booking confirmation alert to tenant admin
- daily reminder to customer, sent 24 hours before appointment when applicable

## 12.5 Tenant template customization

Not allowed in MVP.

## 12.6 WhatsApp opt-in

Not required in MVP because WhatsApp sending is out of scope.

## 12.7 Reminder timing

One reminder in MVP:

- **24 hours before appointment**

If the booking is created less than 24 hours before start time, no reminder is sent.

## 12.8 Tenant admin notifications

Yes. Tenant admins receive email notifications for new bookings.

Experts do not receive notifications in MVP.

## 12.9 Notification retry policy

Retry policy for async delivery failures:

- up to 3 retries
- exponential backoff
- then mark as failed permanently

---

# 13. Admin, Reporting, and Audit Decisions

## 13.1 Mandatory platform admin screens

Required in MVP:

- platform admin login
- tenant list
- create tenant
- view tenant details
- activate/inactivate/suspend tenant
- category management
- booking lookup by tenant/date/reference
- basic audit log list
- basic notification log list

Out of MVP:

- integration management UI
- deep system health dashboards

## 13.2 Required tenant dashboard metrics

Required in MVP:

- bookings today
- upcoming bookings
- total confirmed bookings for selected date range
- cancelled bookings count for selected date range

## 13.3 Audit log detail level

Store:

- actor user id
- actor role
- tenant id if applicable
- entity type
- entity id
- action
- summary
- before snapshot JSON for critical updates
- after snapshot JSON for critical updates
- timestamp
- source IP if available

## 13.4 Retention

Minimum retention:

- audit logs: 12 months
- notification logs: 6 months

## 13.5 Audit log visibility

Audit log visibility:

- platform admin: full access
- tenant admin: tenant-scoped access only for booking and configuration actions within their tenant

---

# 14. Data Model and Persistence Decisions

## 14.1 Database choice

Use:

- **PostgreSQL 16+**
- **PostGIS** enabled

## 14.2 ID strategy

Use **UUIDs** for all primary keys.

## 14.3 Soft delete policy

Use soft-delete style archival fields for:

- tenants
- services
- experts
- locations

Do **not** soft delete bookings.  
Bookings remain immutable records and use status transitions instead.

## 14.4 Uniqueness constraints

Required uniqueness rules:

- tenant slug globally unique
- category slug globally unique
- tenant name not globally unique
- service name unique per tenant
- expert display name not unique
- expert email not unique
- location unique by id only
- booking reference unique globally

## 14.5 Booking snapshots

Yes. Booking must snapshot:

- tenant name
- location name/address snapshot
- service name
- service duration
- displayed price if present
- expert display name
- customer input name/phone/email
- starts_at
- ends_at
- timezone used for display at booking time

## 14.6 Location entity

Yes. `locations` is a separate table in MVP.

## 14.7 Role entity vs enum

Use enums in code for MVP plus tenant membership role columns.  
A dedicated `roles` table is not required.

## 14.8 Availability effective dates

Not required in MVP.

## 14.9 Phone normalization

Yes. Store phone numbers in E.164 format.

---

# 15. API and Technical Stack Decisions

## 15.1 Selected stack

Recommended implementation stack for MVP:

- Frontend web app: **Next.js + React + TypeScript**
- Backend API: **NestJS + TypeScript**
- Database: **PostgreSQL + PostGIS**
- ORM: **Prisma**
- Background jobs: **BullMQ + Redis**
- Email: **Resend, Postmark, or SES** behind provider abstraction
- File storage: **S3-compatible object storage** for logos/photos if enabled
- Hosting: cloud-managed environment suitable for staging and production

## 15.2 API separation

Use one backend API with route namespaces:

- `/public/*`
- `/admin/platform/*`
- `/admin/tenant/*`

Expert routes are not required in MVP.

## 15.3 API auth method

Use:

- secure cookie-based session auth for web admin interfaces
- CSRF protection required
- public booking APIs do not require authentication

JWT is not required in MVP.

## 15.4 Rate limiting

Public endpoints must be rate-limited at least per IP and per endpoint.

## 15.5 Notification API boundary

Notifications should be triggered from domain events, not manually through public APIs.

## 15.6 API contract requirement

Yes. An OpenAPI specification must be produced before or alongside implementation.

---

# 16. Security, Privacy, and Compliance Decisions

## 16.1 Privacy regime

Default compliance target for MVP:

- **India DPDP baseline**
- general privacy good practices influenced by GDPR-style principles

The platform must avoid promising healthcare-grade regulated compliance in MVP.

## 16.2 Sensitive medical data

The platform must **not** store sensitive medical records or diagnosis notes in MVP.

If clinic tenants are onboarded, they are limited to generic appointment scheduling only.

## 16.3 Required consent text

Booking form must capture consent for:

- storing booking information for appointment fulfillment
- contacting the customer regarding the appointment

## 16.4 Deletion and anonymization

MVP must support platform-admin manual anonymization on request, not self-serve deletion.

## 16.5 Admin 2FA

Not required in MVP.

## 16.6 Login lockout and throttling

Required baseline rules:

- progressive rate limiting on login attempts
- temporary lockout after repeated failures, e.g. 10 failed attempts within 15 minutes
- password reset available via email

## 16.7 Upload moderation

No user-generated public uploads beyond logo/expert photo in MVP.  
Virus scanning is recommended if uploads are enabled, but not a hard launch blocker for small MVP usage.

## 16.8 Secrets management

Use managed environment secrets, never hardcoded secrets in code or repository.

---

# 17. Non-Functional Requirements

## 17.1 Target scale for MVP

Initial design target:

- up to 500 tenants
- up to 50 experts per tenant
- up to 5,000 bookings per day platform-wide
- up to 200 concurrent booking users
- up to 100 search requests per minute

## 17.2 Response time targets

Target p95 response times:

- tenant search: <= 800 ms
- available slot lookup: <= 1200 ms
- booking create confirmation: <= 1500 ms excluding async notifications

## 17.3 Availability target

MVP target:

- **99.5% monthly availability**

## 17.4 Backup and restore

Required:

- daily automated database backups
- point-in-time recovery if supported by managed DB
- restore test at least before production launch and periodically after

## 17.5 Observability

Required tooling capabilities:

- structured application logs
- error tracking
- background job monitoring
- DB performance monitoring
- alerting on booking creation failures and job backlog

Specific vendor choice may be finalized by engineering.

## 17.6 Required environments

Required environments:

- local
- development
- staging
- production

Demo environment is optional.

---

# 18. UI and UX Decisions

## 18.1 Brand guidelines

No formal brand system is required to start MVP.

Use a clean neutral interface suitable for marketplace booking.

## 18.2 Default customer booking path

Default public flow:

1. search or open tenant page
2. select tenant
3. select service
4. optionally select expert
5. choose slot
6. enter customer details
7. accept consent
8. confirm booking
9. see confirmation page with booking reference

## 18.3 Booking directly from search results

No direct booking from search result cards in MVP.  
Search results link into the tenant page.

## 18.4 Tenant admin calendar view

Required admin booking views in MVP:

- list view
- day view

Week/month calendar UI is optional.

## 18.5 Expert UI

Separate expert UI is out of MVP.

## 18.6 Accessibility target

Target:

- **WCAG 2.1 AA** for core public booking flows where practical

## 18.7 Languages and locales

MVP supports:

- English only

---

# 19. Operations and Support Decisions

## 19.1 Customer support ownership

Primary support owner for booking issues:

- tenant handles customer appointment issues
- platform handles platform-level technical failures and tenant onboarding issues

## 19.2 Platform admin booking control

Yes. Platform admins can view, edit status, and cancel bookings when necessary for operational support.

## 19.3 Internal notes

Internal staff-only booking notes are out of MVP.

Customer note only is allowed.

## 19.4 Failed booking/conflict logging

Yes. Failed booking attempts caused by slot conflicts or validation failures should be logged in a support-safe way without storing unnecessary sensitive data.

## 19.5 Manual booking creation by tenant staff

Out of MVP.

---

# 20. Documentation and Quality Decisions

## 20.1 Definition of done for MVP

MVP is done only when all of the following are true:

- all P0 functionality in this document is implemented
- staging environment is deployed
- production environment is deployable
- admin and tenant authentication works
- tenant isolation tests pass
- slot generation tests pass
- concurrent booking prevention tests pass
- public booking flow passes end-to-end
- email notification flow works in staging
- audit logging works for critical actions
- observability and error monitoring are active
- rollback and backup procedures are documented

## 20.2 Required automated tests

Minimum required automated tests before launch:

- unit tests for core scheduling and validation logic
- integration tests for booking creation
- concurrency tests for double-book prevention
- permission tests for RBAC and tenant isolation
- API tests for public and admin endpoints
- end-to-end tests for core customer booking flow
- regression tests for cancellation flow

## 20.3 Seed/demo data

Yes. Provide seed data for:

- categories
- sample tenants
- services
- experts
- bookings for non-production environments

## 20.4 Documentation deliverables

Required:

- OpenAPI spec
- engineering setup README
- environment variable reference
- admin user guide
- tenant admin quick-start guide

---

# 21. Resolved Specification Issues

## 21.1 Encoding

The source Markdown must be normalized to **UTF-8**.

## 21.2 Tenant status mismatch resolved

Final tenant statuses are:

- `draft`
- `active`
- `inactive`
- `suspended`

## 21.3 Customer identity ambiguity resolved

MVP uses:

- guest booking
- no customer login
- lookup by booking reference + phone

## 21.4 Branch ambiguity resolved

MVP does not implement branches, but does implement a `locations` table and `location_id` references.

## 21.5 Notification ambiguity resolved

MVP sends **email only**.  
WhatsApp is foundation-only.

## 21.6 Expert permissions ambiguity resolved

Expert login and expert self-service are out of MVP.

## 21.7 Pending status ambiguity resolved

`pending` is removed from MVP booking lifecycle.

## 21.8 Availability precedence resolved

Availability precedence for slot generation is:

1. expert recurring availability rules
2. expert override exceptions for specific dates
3. expert block exceptions
4. existing confirmed bookings

If any conflict exists, the slot is not bookable.

## 21.9 Location model inconsistency resolved

`locations` is a separate table and bookings reference `location_id`.

## 21.10 Security and compliance gap resolved

MVP supports:

- consent capture
- audit logs
- manual anonymization support
- no sensitive health data storage
- baseline privacy controls

## 21.11 Technical stack resolved

Chosen stack is defined in Section 15.

## 21.12 NFRs resolved

Quantitative scale and response targets are defined in Section 17.

---

# 22. Final Recommended Schema Notes

## 22.1 Core entities for MVP

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
- bookings
- notification_logs
- audit_logs

## 22.2 Booking cardinality

Each booking must reference exactly one:

- tenant
- location
- service
- expert

---

# 23. Final Implementation Guardrails

The development team or coding AI agent must follow these rules:

1. Do not add payments in MVP.
2. Do not add customer accounts in MVP.
3. Do not add expert login in MVP.
4. Do not add branch management UI in MVP.
5. Do not add rescheduling in MVP.
6. Do not add group bookings in MVP.
7. Do not expose inactive or suspended tenants publicly.
8. Do not allow double-booking.
9. Do not store sensitive medical notes.
10. Do not rely on non-timezone-aware datetime logic.

---

# 24. Handoff Note for Development Agent

Use this v1.1 addendum together with v1.0.  
When there is any mismatch:

- **v1.1 wins**
- **P0 decisions are mandatory**
- **P1 decisions should be implemented only where they are already explicitly included above**
- **P2 items remain future work**

---