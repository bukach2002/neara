# Admin User Guide

## Platform Admin

Use `/admin/login` with a platform admin account.

Core workflows:

- Tenants: open `/admin/platform`, create draft tenants, review setup counts, and open tenant detail pages.
- Tenant setup: create the first tenant admin from the tenant detail page, then activate only after the validation checklist is satisfied.
- Categories: open `/admin/platform/categories` to create and maintain active marketplace categories.
- Booking lookup: open `/admin/platform/bookings` to filter bookings by tenant, status, appointment date, booking reference, customer, service, or expert. Use `View` for booking details and the pager controls to move through larger result sets.
- Platform cancellation: confirmed bookings can be cancelled from booking lookup. The action writes an audit log and queues a customer cancellation email when the booking has an email snapshot.
- Logs: open `/admin/platform/logs` for audit and notification visibility.

Operational notes:

- Tenant slugs are immutable after activation.
- Inactive and suspended tenants are hidden from public discovery and direct public tenant pages.
- Password reset starts from `/admin/forgot-password`; reset links land on `/admin/reset-password?token=...`.
- Customer anonymization is API-backed for platform admins and preserves non-PII operational booking records.

## Tenant Admin

Use `/admin/login` with a tenant owner/admin/staff account, then open `/admin/tenant` and choose the tenant workspace.

Core workflows:

- Dashboard: review today, upcoming, confirmed, and cancelled booking counts.
- Location: enter address fields, use `Find coordinates` when `GOOGLE_MAPS_API_KEY` is configured, then save the primary location.
- Branding: upload a tenant logo.
- Services: create services, then edit name, duration, display price, active state, and public visibility.
- Experts: create experts, upload expert photos, edit display name, short bio, and active state.
- Assignments: assign active services to experts before activating a tenant.
- Availability: create recurring expert rules, archive rules, create block/override exceptions, and delete exceptions.
- Bookings: filter booking lists, use `View` for booking details, page through larger result sets, and transition confirmed bookings to completed, no-show, or cancelled.

Important constraints:

- Tenant admins cannot access another tenant's workspace.
- Overlapping availability rules for the same expert/day are rejected.
- Override exceptions replace recurring availability for the selected date range.
- Block exceptions remove availability.
- Manual booking creation, rescheduling, customer self-cancellation, payments, and expert login are out of MVP.
