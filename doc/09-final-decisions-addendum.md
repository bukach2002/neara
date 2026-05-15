# Final Decisions Addendum

Applies to: `multi_tenant_appointment_platform_requirements_v1_1_resolved3.md`

This file records final stakeholder decisions made after validation of `resolved3`.

## 1. Availability Override Semantics

Final decision:

- `override` replaces the normal recurring schedule for the specified date or date range.
- `override` does not add extra availability on top of the normal schedule.
- If a tenant admin wants special hours for a date, the override must define the full availability windows for that affected date.

Implementation rule:

- For a date with an override, ignore recurring availability for that expert on that date.
- Apply the override windows.
- Then apply block exceptions and existing bookings.

## 2. Email Provider

Final decision:

- MVP email provider: **Mailtrap**.

Implementation rule:

- Use Mailtrap as the concrete email adapter for MVP.
- Keep the notification provider interface abstract enough to allow future replacement.

## 3. Rate Limits

Final decision:

- Rate-limit values must be read from environment variables.

Implementation rule:

- Do not hardcode rate-limit values directly in business logic.
- Provide sensible defaults for local development if environment variables are missing.
- Document all required rate-limit environment variables in the environment reference.

Recommended environment variables:

- `RATE_LIMIT_PUBLIC_SEARCH_PER_MINUTE`
- `RATE_LIMIT_PUBLIC_SLOT_LOOKUP_PER_MINUTE`
- `RATE_LIMIT_PUBLIC_BOOKING_CREATE_PER_MINUTE`
- `RATE_LIMIT_PUBLIC_BOOKING_LOOKUP_PER_MINUTE`
- `RATE_LIMIT_ADMIN_LOGIN_PER_WINDOW`
- `RATE_LIMIT_PASSWORD_RESET_PER_HOUR`
- `RATE_LIMIT_WINDOW_SECONDS`

## 4. Booking Reference Format

Final decision:

- Booking reference format must use a tenant-specific prefix stored in the database plus a 4-character alphanumeric code.

Format:

```text
{TENANT_PREFIX}-{CODE}
```

Example:

```text
NEAR-7A2K
```

Implementation rules:

- Tenant prefix is stored on the tenant record.
- Tenant prefix must be uppercase alphanumeric.
- Tenant prefix must be unique enough for support clarity, but booking reference uniqueness must still be enforced at database level.
- Code must be 4 uppercase alphanumeric characters.
- Booking reference must be globally unique.
- If a generated reference collides, regenerate and retry.

Important note:

- A 4-character alphanumeric code has limited combinations. This is acceptable for MVP only if collision retry is implemented and booking reference is combined with tenant prefix.

## 5. Expert Auto-Assignment Tie-Breaker

Question: What is this about?

When a customer chooses a service but does not choose a specific expert, the system must pick an expert automatically. If two or more eligible experts have the same earliest available slot, the developer needs a deterministic rule to decide who gets assigned.

Without this rule, different implementations may behave inconsistently.

Final decision:

When multiple experts are eligible for the same selected slot:

- assign the expert with the fewest confirmed bookings on that appointment date.

Implementation note:

- If two experts still have the same booking count, use a deterministic internal fallback such as display name then UUID so the system does not behave randomly.

## 6. Exact Anonymization Fields

Question: What is this about?

Anonymization is needed when a customer asks for their personal data to be removed, but the platform still needs to keep non-personal booking records for reporting, audit, and business operations.

The spec says anonymization is required, so implementation must define exactly which fields are cleared or masked.

Final decision:

- Use industry-standard privacy anonymization practices.
- Remove or irreversibly mask personal data while retaining non-personal operational booking records needed for reporting, audit, and business continuity.

When anonymizing a customer, remove or mask personal data from:

### Customer record

- `name`
- `phone`
- `email`

Replacement values:

- `name`: `Anonymized Customer`
- `phone`: null or irreversible placeholder
- `email`: null

### Booking record snapshots

- `customer_name_snapshot`
- `customer_phone_snapshot`
- `customer_email_snapshot`
- `customer_note`

Replacement values:

- `customer_name_snapshot`: `Anonymized Customer`
- `customer_phone_snapshot`: null or irreversible placeholder
- `customer_email_snapshot`: null
- `customer_note`: null

### Notification logs

Remove or redact personal data from:

- recipient email
- recipient phone
- payload snapshots containing customer name, phone, email, or notes

### Booking attempt logs

Remove or redact:

- customer name
- phone
- email
- free-text note

### Audit logs

Do not rewrite core audit history unless required by policy, but avoid exposing PII:

- redact PII inside before/after JSON snapshots where practical
- keep actor, action, entity type, entity ID, tenant ID, and timestamp

Data to retain:

- booking ID
- booking reference
- tenant ID
- location ID
- service ID
- expert ID
- appointment start/end time
- booking status
- non-PII operational metrics

## 7. Logo and Expert Photo Upload

Final decision:

- Tenant logo upload is in MVP.
- Expert photo upload is in MVP.

Implementation rules:

- Use S3-compatible object storage.
- Allow image files only.
- Validate MIME type and file size.
- Store uploaded file URL/key in the database.
- Do not allow arbitrary file attachments in MVP.
