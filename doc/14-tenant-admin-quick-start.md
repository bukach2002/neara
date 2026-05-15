# Tenant Admin Quick Start

Use this checklist to make a tenant bookable.

1. Sign in at `/admin/login`.
2. Open `/admin/tenant` and select your tenant.
3. Save the primary location:
   - Enter address, locality, and city.
   - Use `Find coordinates` if geocoding is configured.
   - Confirm latitude and longitude, then save.
4. Create at least one service:
   - Use a fixed duration.
   - Keep `Active` and `Public` enabled for customer booking.
5. Create at least one expert.
6. Assign the service to the expert.
7. Add recurring availability for the expert.
8. Ask the platform admin to activate the tenant.
9. Test the public page at `/tenants/{tenant-slug}` and create a booking.

Daily operation:

- Use the booking section in the tenant workspace to search and filter appointments.
- Mark completed appointments as `completed`.
- Mark missed appointments as `no-show`.
- Cancel only when the business needs to cancel; customer self-cancellation is not part of MVP.

Availability changes:

- Use recurring rules for normal weekly working windows.
- Use a block exception for time off or unavailable periods.
- Use an override exception for special working hours on specific dates. Overrides replace normal recurring hours for the selected date range.
