# Technical Requirements Document
## Multi-Tenant Appointment Booking Platform
### Version 1.0
### Status: Working Draft for Implementation

## 1. Purpose

Build a **multi-tenant appointment booking platform** where:

- **Tenant admins** can configure their business, services, experts, availability, and booking rules.
- **End users** use a **single tenant-agnostic application** to discover tenants and book appointments.
- The initial implementation should prioritize a **simple web-first MVP** with clean, low-friction UX suitable for non-technical users.
- Architecture must support future evolution into advanced discovery, recommendations, payments, branches, and deeper automation.

This document is intentionally detailed so that a coding AI agent can use it as an implementation blueprint.

## 2. Product Vision

The platform is a marketplace-style appointment system with:

- **One shared customer-facing app**
- **Many tenants/businesses**
- Each tenant may offer:
  - One or more services
  - One or more experts/providers
  - Configurable booking settings
  - Searchable location data
- Customers can:
  - Search tenants
  - Filter by category and locality
  - Search by keyword
  - View tenant offerings
  - Book appointments through the app

## 3. Implementation Philosophy

### 3.1 MVP principles

The MVP must be:

- **Simple**
- **Fast to build**
- **Reliable**
- **Configurable at tenant level**
- Designed for **future extensibility**, but without overbuilding

### 3.2 UX principles

The UI must be:

- Web-first
- Mobile-friendly responsive
- Extremely simple for a layman
- Minimal cognitive load
- Search-led and booking-led
- Low number of steps to confirm a booking

## 4. Confirmed Product Decisions from Discussion

The following are treated as **current approved decisions**:

1. **End users are tenant agnostic**
   - Customers use one application to browse all tenants.

2. **Discovery**
   - Customers can find tenants by:
     - Category
     - Locality
     - Keyword search
     - Geolocation-based sorting
   - “Smart recommendations” are **not MVP**.

3. **Search**
   - Keyword search is required.
   - Search results should be sorted by geolocation where relevant.

4. **Tenant configuration**
   - Availability and business rules should be **configurable by tenant admin**.
   - Service configuration should be dynamic/configurable.

5. **Calendar model**
   - **Expert-specific calendar** is required.
   - MVP should begin with tenant-level practicality, but expert schedules are supported.

6. **Location**
   - Each tenant must add map location.
   - If branches are introduced, each branch must have a map location.
   - Radius-based search must be supported.

7. **Booking payment**
   - For MVP: **book without payment**
   - Some tenants may impose minimum booking fee later, but **not in MVP**.

8. **WhatsApp**
   - Start with **single Meta WABA account**.

9. **Booking flow**
   - User should be able to “just book”.
   - Optional steps may exist, but flow should stay minimal.

10. **Documentation goal**
   - This documentation will evolve with follow-up answers and decisions.

## 5. Scope by Phase

### Phase 1 — MVP Foundation

This phase must be built first.

#### Included in MVP

- Multi-tenant system
- Tenant onboarding/admin
- Service management
- Expert management
- Expert-specific availability/calendar
- Tenant location capture
- Customer-facing tenant discovery
- Search by keyword
- Filter by category and locality
- Geolocation/radius support
- Appointment booking
- Booking status management
- Basic customer details capture
- Tenant-side appointment management
- Basic notifications
- Single WABA integration foundation
- Simple web UI

#### Excluded from MVP

- Smart recommendations
- Online payment collection
- Dynamic pricing complexity
- Loyalty/referrals
- Advanced analytics
- Multi-WABA support
- Complex branch-level routing logic
- AI-driven scheduling optimization
- Customer wallet/subscription
- Deep CRM or marketing automation
- Native mobile apps

### Phase 2 — Operational Maturity

#### Potential inclusions

- Branch support as first-class entity
- Buffer times and slot rules
- Reschedule/cancel policies
- Waitlist
- Booking notes and attachments
- Optional prepayment/minimum booking fee
- Richer notification workflows
- Tenant reporting dashboard
- Staff roles/permissions
- Better SEO/public tenant pages

### Phase 3 — Growth Layer

#### Potential inclusions

- Smart recommendations
- Personalization
- Ranking optimization
- Promotions/coupons
- Reviews and ratings
- Repeat booking shortcuts
- Customer history
- Advanced location intelligence
- Multi-WABA / per-tenant communication channel support

## 6. User Roles

### 6.1 Platform Super Admin

Responsible for platform-wide administration.

#### Capabilities

- Manage tenants
- Approve/suspend tenants
- View all bookings
- Manage categories
- Manage platform configuration
- View system health and logs
- Manage communication settings
- Manage integrations
- Override problematic tenant state if needed

### 6.2 Tenant Admin

Responsible for managing one tenant/business.

#### Capabilities

- Manage tenant profile
- Manage services
- Manage experts
- Configure availability
- Configure booking rules
- View and manage bookings
- Update location
- Configure basic communication preferences
- View operational dashboards

### 6.3 Expert / Service Provider

Represents a staff member who performs appointments.

#### Capabilities

- View assigned bookings
- View personal calendar
- Mark availability/unavailability
- Accept or manage appointments if workflow requires
- Block time slots
- Update service delivery status where allowed

### 6.4 End User / Customer

Customer using the shared application.

#### Capabilities

- Search tenants
- Filter tenants
- View services and experts
- Select date/time
- Book appointment
- View booking details
- Cancel/reschedule if tenant rules allow
- Receive booking confirmations

## 7. High-Level Functional Architecture

The system should be split into the following logical modules:

1. **Identity & Access**
2. **Tenant Management**
3. **Catalog Management**
   - Categories
   - Services
   - Experts
4. **Availability & Scheduling**
5. **Search & Discovery**
6. **Booking Management**
7. **Notification & Communication**
8. **Location & Geospatial**
9. **Admin & Reporting**
10. **Integration Layer**
11. **Audit & Configuration**

## 8. Detailed Functional Requirements

### 8.1 Identity and Access Management

#### 8.1.1 User types

The system must support separate identities for:

- Platform admin
- Tenant admin
- Experts
- Customers

#### 8.1.2 Authentication

MVP should support:

- Tenant admin login
- Expert login
- Customer login or lightweight booking identity

Recommended MVP approach:

- Admin/expert: email + password
- Customer: phone/email OTP or lightweight sign-in

#### 8.1.3 Authorization

Role-based access control is required.

Permissions must be enforced so that:

- Platform admin can access all tenants
- Tenant admin can access only their own tenant’s data
- Experts can access only their own schedules/bookings unless explicitly extended
- Customers can access only their own bookings/profile

#### 8.1.4 Session and security basics

- Secure password hashing
- Session expiration
- CSRF protection for web app
- Basic login throttling/rate limiting
- Audit logging for admin-sensitive actions

### 8.2 Tenant Management

#### 8.2.1 Tenant entity

A tenant represents a business/service provider.

A tenant must support:

- Tenant name
- Slug/URL-safe identifier
- Description
- Business category
- Contact details
- Address
- Geo-coordinates
- Status (active/inactive/pending/suspended)
- Branding fields (logo, banner optional)
- Booking policy settings
- Time zone
- Operating hours
- Communication settings

#### 8.2.2 Tenant onboarding

Platform admin should be able to create tenants manually in MVP.

Later phases may add self-serve tenant onboarding.

#### 8.2.3 Tenant status lifecycle

A tenant must support at least:

- Draft
- Active
- Inactive
- Suspended

Suspended tenants must not appear in public search results.

### 8.3 Category Management

Categories are used for discovery and filtering.

#### Requirements

- Platform admin can create/edit/deactivate categories
- Each tenant belongs to one or more categories
- Categories should be available as search/filter inputs
- Category metadata should support:
  - Name
  - Slug
  - Description
  - Icon/image optional
  - Active status
  - Sort order

### 8.4 Service Management

Each tenant can define its own services.

#### 8.4.1 Service configuration

Services must be configurable by tenant admin.

Each service should support:

- Name
- Description
- Duration
- Buffer before/after optional
- Active/inactive
- Category mapping if needed
- Booking lead time constraints
- Slot interval rules if applicable
- Assigned experts
- Optional price field for future use
- Optional booking fee field for future use, but not active in MVP
- Max bookings per slot if group service is ever supported later

#### 8.4.2 Service-assignment model

A service may be:

- Offered by one expert
- Offered by many experts

The data model must support many-to-many between services and experts.

### 8.5 Expert Management

Experts are tenant-owned staff or providers.

#### Requirements

Tenant admin must be able to:

- Create expert profile
- Edit expert profile
- Activate/deactivate expert
- Assign services
- Manage availability/calendar

Each expert should support:

- Full name
- Display name
- Bio optional
- Photo optional
- Status
- Contact details optional
- Tenant ownership
- Service assignments
- Calendar settings
- Working hours
- Breaks/unavailability
- Booking load controls if needed later

### 8.6 Availability and Scheduling

This is a core system module.

#### 8.6.1 Calendar model

Expert-specific calendar is required.

Each expert must have:

- Working schedule
- Slot availability
- Blocked dates/times
- Existing booked appointments
- Optional exceptions (holidays, leave, manual blocks)

#### 8.6.2 Tenant-configurable scheduling rules

Tenant admin should be able to configure at minimum:

- Working days
- Working hours
- Slot duration or service duration handling
- Advance booking window
- Minimum notice before booking
- Reschedule/cancellation policy placeholders
- Optional blackout dates

#### 8.6.3 Slot generation

System must generate valid bookable slots based on:

- Service duration
- Expert availability
- Existing appointments
- Booking rules
- Manual blocks
- Tenant local timezone

#### 8.6.4 Double booking prevention

The system must prevent conflicting appointments for the same expert.

Conflict handling must be transactional and safe against concurrent bookings.

#### 8.6.5 Timezone handling

All booking logic must be timezone-aware.

Recommended rule:

- Store timestamps in UTC
- Render in tenant timezone or customer-selected/local timezone where applicable

### 8.7 Location and Geospatial Search

#### 8.7.1 Tenant location

Each tenant must have location data.

Minimum required fields:

- Address line(s)
- City/locality
- State/region
- Postal code optional
- Country
- Latitude
- Longitude

#### 8.7.2 Branch consideration

For MVP, system may operate at tenant-level location.

However, data model should not block future branch support.

Recommended approach:

- Prepare optional `branch` entity in schema or architecture, even if inactive in MVP.

#### 8.7.3 Search by proximity

System must support:

- User location-based sorting
- Radius-based search/filtering
- Locality-based filtering

##### Search inputs

- Keyword
- Category
- Locality
- Radius
- Geolocation coordinates

### 8.8 Customer Discovery and Search

#### 8.8.1 Customer-facing listing

Customer must be able to browse all active tenants in one shared app.

Each listing should show enough information for decision-making, such as:

- Tenant name
- Category
- Address/locality
- Distance if location available
- Key services
- Rating placeholder for future
- Availability teaser optional
- CTA to view/book

#### 8.8.2 Search behavior

MVP search must support:

- Keyword search
- Category filtering
- Locality filtering
- Geolocation sorting

Keyword search should match against at least:

- Tenant name
- Tenant description
- Service names
- Category names
- Locality

#### 8.8.3 Smart recommendations

Not part of MVP.

Architecture should leave room for future ranking/recommendation engine, but no implementation required now.

### 8.9 Booking Management

This is the main customer transaction flow.

#### 8.9.1 Booking flow

Recommended MVP booking flow:

1. Customer searches or browses tenants
2. Customer opens tenant page
3. Customer selects service
4. Customer selects expert if needed
5. Customer selects date/time slot
6. Customer enters details
7. Customer confirms booking
8. System creates booking
9. System sends confirmation

#### 8.9.2 Booking fields

Each booking should capture:

- Booking ID
- Tenant ID
- Expert ID
- Service ID
- Customer ID or guest identifier
- Customer name
- Customer phone
- Customer email optional
- Appointment date/time
- Duration
- Status
- Notes optional
- Source channel
- Created at
- Updated at
- Cancellation reason optional
- Reschedule linkage optional for future

#### 8.9.3 Booking statuses

Minimum statuses:

- Pending
- Confirmed
- Cancelled
- Completed
- No-show

Optional depending on workflow:

- Rescheduled
- Rejected

#### 8.9.4 Booking confirmation

For MVP, booking can be instant unless tenant workflow later requires approval.

Current recommended MVP:

- Default to instant confirmation after valid slot selection.

#### 8.9.5 Booking without payment

MVP must support booking with no payment step.

Future design must not assume payment is always absent.

### 8.10 Customer Data Handling

#### MVP requirements

Capture minimum necessary customer information:

- Name
- Mobile number
- Email optional

#### Rules

- Duplicate customers may later be merged, but MVP may allow repeated booking records by same phone/email
- Customer booking history should be retrievable if account identity exists
- Privacy and consent controls should be considered

### 8.11 Notifications and Communication

#### 8.11.1 Notification events

The system should support notifications for:

- Booking created
- Booking confirmed
- Booking cancelled
- Booking reminder
- Booking rescheduled (future-ready)

#### 8.11.2 Channels

MVP channels:

- Email optional/basic
- WhatsApp foundation via single Meta WABA account
- SMS optional only if chosen later

#### 8.11.3 WABA constraints

Single Meta WABA account must be assumed at platform level in MVP.

This means:

- Message sending is centralized
- Templates/messages may need tenant context inserted dynamically
- Per-tenant sender identity is not required in MVP

#### 8.11.4 Communication architecture

Notification engine should be event-driven enough to support future expansion.

Recommended components:

- Notification event producer
- Template manager
- Delivery adapter(s)
- Message log/audit table

### 8.12 Tenant-side Booking Operations

Tenant admin must be able to:

- View bookings list
- Filter bookings by date/status/expert/service
- View booking details
- Cancel booking
- Mark completed
- Mark no-show
- Optionally edit booking notes
- Manually create booking if needed later

Experts may have limited operational views for:

- Upcoming appointments
- Daily schedule
- Mark status updates if allowed

### 8.13 Admin and Reporting

#### 8.13.1 Platform admin reporting

Must be able to view:

- Total tenants
- Active tenants
- Total bookings
- Bookings by status
- Bookings by tenant
- Usage trend basics

#### 8.13.2 Tenant dashboard

MVP tenant dashboard should include:

- Today’s bookings
- Upcoming bookings
- Booking status counts
- Expert schedule snapshot

Advanced analytics can wait.

## 9. Data Model Requirements

This section is written so a coding AI can infer schema design.

### 9.1 Core entities

Minimum core entities:

- User
- Role
- Tenant
- Category
- TenantCategory
- Service
- Expert
- ExpertService
- AvailabilityRule
- AvailabilityException
- Booking
- Customer
- NotificationLog
- AuditLog
- Location

### 9.2 Suggested relational model

#### User
- id
- role_id
- tenant_id nullable
- name
- email
- phone
- password_hash
- status
- created_at
- updated_at

#### Tenant
- id
- name
- slug
- description
- primary_category_id optional
- phone
- email
- address_line1
- address_line2
- locality
- city
- state
- country
- postal_code
- latitude
- longitude
- timezone
- status
- created_at
- updated_at

#### Category
- id
- name
- slug
- description
- is_active
- sort_order

#### Service
- id
- tenant_id
- name
- description
- duration_minutes
- is_active
- booking_lead_time_minutes optional
- advance_booking_days optional
- price nullable
- booking_fee nullable future
- created_at
- updated_at

#### Expert
- id
- tenant_id
- name
- display_name
- bio
- avatar_url
- status
- email optional
- phone optional
- created_at
- updated_at

#### ExpertService
- id
- expert_id
- service_id

#### AvailabilityRule
- id
- tenant_id
- expert_id nullable depending on design
- day_of_week
- start_time
- end_time
- is_active

#### AvailabilityException
- id
- tenant_id
- expert_id
- start_datetime
- end_datetime
- reason
- type (block/leave/override)

#### Customer
- id
- name
- phone
- email nullable
- created_at
- updated_at

#### Booking
- id
- tenant_id
- service_id
- expert_id
- customer_id nullable if guest model
- customer_name_snapshot
- customer_phone_snapshot
- customer_email_snapshot
- starts_at
- ends_at
- status
- notes
- booking_source
- created_at
- updated_at

#### NotificationLog
- id
- booking_id nullable
- tenant_id
- channel
- template_key
- delivery_status
- provider_message_id
- payload_snapshot
- created_at

#### AuditLog
- id
- actor_user_id
- tenant_id nullable
- entity_type
- entity_id
- action
- change_summary
- created_at

## 10. API Requirements

The system should expose clean APIs so a coding AI can implement frontend and backend separately.

### 10.1 API style

Recommended:

- REST for MVP
- JSON request/response
- Token-based auth

GraphQL is unnecessary for MVP unless already chosen.

### 10.2 Required API domains

#### Auth APIs
- login
- logout
- password reset
- OTP verify if used for customer

#### Tenant APIs
- list tenants
- get tenant details
- create tenant
- update tenant
- activate/deactivate tenant

#### Category APIs
- list categories
- create/update categories

#### Service APIs
- list tenant services
- create service
- update service
- activate/deactivate service

#### Expert APIs
- list experts by tenant
- create expert
- update expert
- assign services
- get expert calendar/availability

#### Availability APIs
- set recurring availability
- set exceptions/blocked times
- fetch available slots

#### Search APIs
- search tenants by keyword
- filter by category/locality
- search by coordinates/radius

#### Booking APIs
- create booking
- list bookings
- get booking details
- cancel booking
- update booking status
- fetch available slots before booking

#### Notification APIs
- internal/admin-oriented; public exposure minimal

## 11. Frontend Requirements

### 11.1 Customer app pages

Minimum pages/screens:

1. Home/search page
2. Search results / tenant listing
3. Tenant detail page
4. Service selection
5. Expert selection
6. Date/time slot selection
7. Booking details form
8. Booking confirmation page
9. Customer booking lookup optional/basic

### 11.2 Tenant admin pages

Minimum pages/screens:

1. Login
2. Dashboard
3. Tenant profile settings
4. Service management
5. Expert management
6. Availability/calendar management
7. Bookings list
8. Booking detail view

### 11.3 UX expectations

- Responsive layout
- Low-click booking flow
- Clear labels
- Human-friendly date/time presentation
- Minimal required form fields
- Search and booking CTAs always visible

## 12. Search and Ranking Requirements

### MVP ranking priorities

Search results should consider:

1. Text match relevance
2. Tenant active status
3. Category/locality match
4. Distance from user if location available
5. Basic sort stability

No machine learning or recommendation ranking required in MVP.

## 13. Non-Functional Requirements

### 13.1 Performance

- Search/list APIs should feel responsive
- Slot lookup should be efficient
- Booking creation should be safe under concurrent access
- Pages should load quickly on mobile web

### 13.2 Scalability

Architecture must support:

- Many tenants
- Many services and experts
- Increasing search volume
- Future branch support
- Future payment and recommendation modules

### 13.3 Reliability

- No double bookings
- Graceful handling of failed notifications
- Audit trail for critical admin actions
- Booking transaction consistency

### 13.4 Security

- Role-based access control
- Tenant data isolation
- Encrypted transport (HTTPS)
- Secure secret handling
- Input validation and sanitization
- Rate limiting on public booking/search endpoints

### 13.5 Observability

System should include:

- Structured logs
- Error tracking
- Booking event logs
- Notification delivery logs
- Admin activity audit logs

## 14. Suggested Technical Architecture

This is not mandatory, but strongly recommended for a coding AI agent.

### 14.1 Preferred architecture

For MVP:

- Modular monolith is recommended over microservices

Reason:

- Faster delivery
- Simpler debugging
- Easier transactional integrity for booking logic

### 14.2 Suggested layers

- Presentation layer
- Application/service layer
- Domain/business rules layer
- Persistence/data access layer
- Integration layer
- Background jobs/events layer

### 14.3 Suggested infrastructure

- Relational DB recommended
- Background job queue for notifications/reminders
- Geospatial indexing support if possible
- Object storage for images/files if needed
- Centralized logging

## 15. Booking Logic Rules

These rules must be explicit for implementation.

### 15.1 Slot availability rule

A slot is bookable only if:

- Tenant is active
- Service is active
- Expert is active
- Expert is assigned to the service
- Slot falls within allowed schedule
- Slot does not overlap existing booking
- Slot is not blocked by exception
- Slot respects notice/advance-booking rules

### 15.2 Concurrency rule

When customer confirms a booking:

- System must revalidate slot availability
- Booking creation must be atomic
- Conflict must return clean user-facing error

### 15.3 Cancellation rule

For MVP:

- Cancellation may be permitted by tenant/admin workflow
- Customer self-cancellation can be added if desired later
- Cancellation reason should be captured where possible

## 16. Notification Requirements

### 16.1 Templates

System should support template-based messages.

At minimum:

- Booking confirmation
- Booking cancellation
- Reminder

Each template must allow dynamic variables like:

- Customer name
- Tenant name
- Service name
- Expert name
- Date/time
- Location

### 16.2 Reminder scheduling

The system should be designed to support reminders, even if not all reminder scenarios are enabled on day one.

## 17. Audit and Compliance Considerations

Minimum audit coverage:

- Tenant created/updated/suspended
- Service created/updated/deactivated
- Expert created/updated/deactivated
- Availability changed
- Booking status changed
- Admin override actions
- Notification attempts

## 18. Edge Cases the Coding Agent Must Handle

1. Two users trying to book the same slot at the same time
2. Expert becomes inactive after slots were previously visible
3. Tenant deactivated while bookings exist
4. Invalid or missing geo-coordinates
5. Search with no user location available
6. Services with no active experts
7. Slot visible but already taken by time of booking submission
8. Notification send failure after successful booking
9. Timezone edge cases
10. Booking status inconsistencies from manual admin action

## 19. Acceptance Criteria for MVP

The MVP is considered functionally complete when:

1. Platform admin can create and manage tenants
2. Tenant admin can create services and experts
3. Tenant admin can define expert availability
4. Customer can search tenants by keyword/category/locality
5. Customer can discover tenants based on location/radius
6. Customer can view available slots
7. Customer can successfully create booking without payment
8. System prevents double booking
9. Tenant admin can view and manage bookings
10. Basic notifications/logging exist
11. Data isolation between tenants is enforced
12. UI is simple enough for non-technical users

## 20. Recommended Delivery Order for the Coding AI Agent

### Sprint / Build Order

#### Stage 1
- Project setup
- Auth and RBAC
- Core DB schema
- Tenant/category models

#### Stage 2
- Service and expert management
- Availability/calendar logic

#### Stage 3
- Public tenant discovery/search
- Geolocation/locality filters

#### Stage 4
- Slot generation
- Booking flow
- Concurrency-safe booking creation

#### Stage 5
- Tenant booking operations dashboard
- Status management

#### Stage 6
- Notifications
- Audit logs
- Basic reporting

#### Stage 7
- Polish, validation, edge-case hardening

## 21. Known Open Decisions for Future Clarification

These are not blockers for writing code, but they may need follow-up decisions:

1. Customer authentication model
   - guest booking vs OTP vs full account

2. Booking confirmation policy
   - instant confirm vs pending approval for some tenants

3. Multi-location/branch model timing
   - phase 1.5 vs phase 2

4. Expert self-management permissions
   - how much experts can edit

5. Cancellation/reschedule rights
   - admin only vs customer allowed

6. Reminder timing policy
   - fixed vs configurable

7. Search ranking details
   - exact weighting between relevance and distance

8. WhatsApp template rules
   - exact message flows and template content

## 22. Instruction to Future Coding AI Agent

Use this document as the source of truth.

When details are missing, follow these rules:

1. Prefer MVP simplicity over advanced abstractions
2. Keep architecture extensible
3. Do not implement non-MVP features unless necessary for foundation
4. Preserve tenant data isolation at all times
5. Ensure booking logic is transaction-safe
6. Keep user flows minimal and user-friendly
7. Treat expert calendar correctness as critical

## 23. Change Log

### v1.0
- Initial structured technical requirements created from conversation decisions
- Phased scope introduced
- Functional modules detailed
- Core data and API direction documented
- Open decisions listed for follow-up updates
