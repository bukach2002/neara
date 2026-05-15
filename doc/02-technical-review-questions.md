# Questions and Clarifications

Review of `multi_tenant_appointment_platform_requirements_v1.md` from a lead technical developer perspective.

The current specification is a strong foundation, but several areas need clarification before implementation can be estimated and built safely. The questions below are grouped by product area and marked with priority:

- **P0**: Must clarify before MVP implementation
- **P1**: Important for MVP quality and avoiding rework
- **P2**: Can be decided during or after MVP if a sensible default is chosen

## 1. Product Scope and MVP Boundary

1. **P0 - What is the exact MVP launch scope?**  
   The document includes both required MVP items and future-ready placeholders. Should the MVP include only booking without payment, tenant search, expert availability, tenant admin, and basic notifications, or should any branch/payment/reporting/SEO foundations be implemented in the first release?

2. **P0 - Who are the first target tenant types?**  
   The requirements are generic across appointments. Are we targeting salons, clinics, consultants, fitness, home services, or all categories from day one? This affects service duration, location handling, expert selection, cancellation expectations, and notification copy.

3. **P1 - Is this marketplace discovery-first or tenant-page booking-first?**  
   Should users primarily search across all tenants, or will tenants share direct links to their own booking pages? This affects routing, SEO, tenant slugs, and the public homepage.

4. **P1 - What does "simple web-first MVP" mean for devices and browsers?**  
   Which browsers and minimum mobile screen sizes must be supported?

5. **P1 - Are native mobile apps explicitly out of scope for the first production release?**  
   The spec excludes native mobile apps, but mobile web behavior still needs clear acceptance criteria.

## 2. User Identity and Authentication

6. **P0 - What customer identity model should MVP use?**  
   Options mentioned are guest booking, OTP, or full account. Which one is required for MVP?

7. **P0 - Is customer login required before booking?**  
   If not, how does a customer view, cancel, or reschedule an existing booking?

8. **P0 - What fields uniquely identify a customer?**  
   Should phone number be unique globally, per country, or not unique at all? Should email be unique?

9. **P0 - Which OTP channel should be used if OTP is selected?**  
   WhatsApp, SMS, email, or a combination?

10. **P1 - How should admin and expert accounts be invited?**  
    Should tenant admins create experts with passwords, send invitation emails, or create inactive accounts until experts accept?

11. **P1 - Can one user belong to multiple tenants?**  
    For example, an expert working at two businesses or a platform admin who also manages a tenant.

12. **P1 - Is role assignment single-role or multi-role?**  
    The suggested `User` model has one `role_id`, but real users may need multiple roles.

13. **P1 - What password reset and account recovery flows are required?**

## 3. Tenancy and Data Isolation

14. **P0 - What is the tenant isolation strategy?**  
    Shared database with tenant IDs, schema-per-tenant, or database-per-tenant? The spec implies shared relational tables but does not explicitly decide.

15. **P0 - Which public data is visible across tenants?**  
    Tenant listings, services, experts, and availability may be public. Are expert contact details, exact address, and profile photos public?

16. **P0 - What happens to existing bookings when a tenant is suspended or deactivated?**  
    Should bookings remain valid, be cancelled automatically, or require platform admin review?

17. **P1 - Can tenant admins export their data?**  
    This affects reporting, privacy, and operational support.

18. **P1 - Are tenant slugs globally unique and immutable?**  
    If slugs can change, should old URLs redirect?

## 4. Tenant Onboarding and Administration

19. **P0 - Who creates the first tenant admin user?**  
    Platform admin during manual tenant creation, tenant self-signup, or a seeded system user?

20. **P0 - What tenant statuses are actually required?**  
    The spec lists `pending`, `draft`, `active`, `inactive`, and `suspended` in different places. What is the final status lifecycle?

21. **P1 - What are the minimum required fields to activate a tenant?**  
    For example: name, category, location, timezone, at least one active service, at least one active expert, and availability.

22. **P1 - Should inactive tenants remain accessible by direct URL?**  
    Or should they be hidden everywhere?

23. **P2 - Are branding fields needed in MVP?**  
    Logo and banner are optional, but supporting uploads adds storage and moderation concerns.

## 5. Categories and Services

24. **P0 - Can a service belong to multiple categories or only inherit tenant categories?**

25. **P0 - Is service price displayed in MVP?**  
    The spec says booking is without payment, but includes optional price fields. Should customers see prices?

26. **P0 - Are service durations fixed or can they vary by expert?**  
    Some businesses may have one service duration per expert.

27. **P0 - Are buffers before/after part of MVP scheduling logic?**  
    Buffer fields are described as optional/future, but slot generation can be heavily affected by them.

28. **P1 - Can a service be bookable without selecting a specific expert?**  
    If yes, should the system auto-assign any available expert?

29. **P1 - Can services be hidden from public booking but visible to tenant admins?**

30. **P1 - Are group bookings/classes in scope at all for MVP?**  
    The spec mentions max bookings per slot for future. Confirm MVP is strictly one customer, one expert, one service, one time slot.

## 6. Expert Management

31. **P0 - Are experts always system users?**  
    Can a tenant create an expert profile without login access?

32. **P0 - Can experts manage their own availability in MVP?**  
    The role section says experts can mark availability/unavailability, but tenant admin pages also manage calendars.

33. **P1 - Can one appointment require multiple experts?**  
    The current model assumes one expert per booking.

34. **P1 - Are expert profiles public to customers?**  
    If yes, which fields are displayed?

35. **P1 - Can an expert be assigned to inactive services or vice versa?**  
    Define validation and behavior for these edge states.

## 7. Availability and Scheduling

36. **P0 - What is the canonical availability model for MVP?**  
    Tenant-level working hours inherited by experts, expert-specific schedules only, or both?

37. **P0 - What slot interval should be used?**  
    Should slots be generated every 5, 10, 15, 30, or service-duration minutes? Is this tenant-configurable?

38. **P0 - How should overlapping availability rules be handled?**  
    For example, two working periods on the same day or an override that partially overlaps a block.

39. **P0 - Are availability exceptions blocks only, or can they add special working hours?**  
    The spec mentions `block/leave/override`; implementation behavior needs definition.

40. **P0 - What is the minimum notice rule default?**  
    For example, can a customer book a slot starting in 5 minutes?

41. **P0 - What is the advance booking window default?**  
    For example, 30, 60, or 90 days.

42. **P0 - What timezone should customers see?**  
    Tenant timezone, customer local timezone, or both?

43. **P0 - How should daylight saving time transitions be handled in slot generation?**  
    This matters for Europe/London and other DST zones.

44. **P1 - Should appointment end time be derived from service duration at booking time and stored as a snapshot?**

45. **P1 - Can tenant admins manually create bookings outside normal availability?**

46. **P1 - Can tenant admins override double-booking prevention?**  
    Recommended default: no, unless there is an explicit override permission and audit reason.

## 8. Booking Flow and Booking Lifecycle

47. **P0 - Is booking confirmation always instant in MVP?**  
    The spec recommends instant confirmation but also includes `Pending`.

48. **P0 - What exact statuses and transitions are allowed?**  
    Define legal transitions, for example `confirmed -> cancelled`, `confirmed -> completed`, `confirmed -> no_show`.

49. **P0 - Is `Pending` needed if there is no approval workflow or payment step?**

50. **P0 - Who can cancel a booking in MVP?**  
    Tenant admin only, customer, expert, or platform admin?

51. **P0 - Is rescheduling in MVP or future only?**  
    The role capabilities mention customer rescheduling if rules allow, but the MVP scope does not clearly require it.

52. **P0 - What customer details are mandatory at booking?**  
    Name and mobile are listed. Is country code mandatory? Is email optional in all cases?

53. **P1 - Should customers receive a booking reference code?**  
    This is useful for guest lookup and support.

54. **P1 - Should duplicate active bookings be prevented for the same customer/service/time?**

55. **P1 - Can customers add notes?**  
    If yes, are notes visible to experts?

56. **P1 - What should happen if notification fails after booking succeeds?**  
    The spec says handle gracefully, but operational behavior should be clear.

57. **P1 - Should booking creation require explicit consent to communication/privacy terms?**

## 9. Search and Discovery

58. **P0 - What search engine should MVP use?**  
    Database full-text search, external search service, or simple SQL `LIKE`/trigram search?

59. **P0 - What location provider should be used for maps/geocoding?**  
    Google Maps, Mapbox, OpenStreetMap/Nominatim, or manual latitude/longitude entry?

60. **P0 - How should user location be captured?**  
    Browser geolocation prompt, manual locality input, postcode, current map pin, or all of these?

61. **P0 - What is the default radius?**  
    For example, 5 km, 10 km, 25 km, or user-selected.

62. **P0 - What distance unit should be used?**  
    Kilometers or miles? This may depend on launch country.

63. **P0 - What is the launch geography?**  
    Country and locale affect address fields, phone validation, timezone defaults, currency, distance units, and maps.

64. **P1 - How should ranking combine text relevance and distance?**  
    The spec lists both but does not define precedence when a far tenant is a stronger text match.

65. **P1 - Should tenants with no upcoming availability appear in search results?**

66. **P1 - Should service names be searchable globally, or only after opening a tenant?**

67. **P2 - Is SEO for public tenant pages required in MVP?**

## 10. Location and Future Branches

68. **P0 - Should the MVP include a `Branch` table or only leave room in architecture?**  
    The spec says prepare optional branch entity, but also excludes branch-level routing complexity.

69. **P0 - If branches are not implemented, how should future migration be protected?**  
    For example, should bookings reference a `location_id` now instead of tenant address fields?

70. **P1 - Can a tenant have service-specific locations?**  
    For example, online consultation, at-home service, or branch-based service.

71. **P1 - Are online/remote appointments supported?**  
    If yes, geospatial assumptions change.

## 11. Notifications and WhatsApp

72. **P0 - Which notification channels are required on day one?**  
    Email, WhatsApp, both, or neither initially with logs only?

73. **P0 - Is WhatsApp sending required in MVP or only foundation/schema?**

74. **P0 - Who owns Meta WABA setup and template approval?**  
    This can block production notifications.

75. **P0 - What exact message templates are required for MVP?**  
    Booking confirmation, cancellation, reminder, tenant alert, expert alert?

76. **P0 - Are tenants allowed to customize notification templates?**  
    If yes, what approval or validation process is needed?

77. **P1 - Should customers opt in to WhatsApp messages at booking time?**

78. **P1 - What reminder timing should be used?**  
    For example, 24 hours before and 1 hour before. Is it tenant-configurable?

79. **P1 - Should tenant admins and experts receive notifications for new bookings?**

80. **P1 - What retry policy should notification delivery use?**

## 12. Admin, Reporting, and Audit

81. **P0 - What platform admin screens are mandatory for MVP?**  
    The spec lists broad capabilities, including logs and integrations. Which ones are required in the first build?

82. **P0 - What tenant dashboard metrics are required on day one?**

83. **P1 - What audit log details must be stored?**  
    Full before/after values, summary only, actor IP, user agent, reason codes?

84. **P1 - How long should audit logs and notification logs be retained?**

85. **P1 - Who can view audit logs?**

## 13. Data Model and Persistence

86. **P0 - Which database is selected?**  
    PostgreSQL is implied by relational and geospatial needs, but not explicitly chosen.

87. **P0 - Are UUIDs or sequential numeric IDs preferred?**

88. **P0 - Should soft delete be used for tenants, services, experts, customers, and bookings?**

89. **P0 - What uniqueness constraints are required?**  
    Examples: tenant slug, category slug, service name per tenant, expert email per tenant, customer phone.

90. **P0 - Should booking fields snapshot service name, expert name, tenant address, and price?**  
    Snapshotting protects historical accuracy when admin data changes.

91. **P1 - Should `Location` be a separate entity in MVP?**  
    The core entity list includes `Location`, but the suggested `Tenant` model stores address fields directly.

92. **P1 - Should `Role` be a table or fixed enum?**

93. **P1 - Should `AvailabilityRule` support effective dates?**  
    For example, working hours change starting next month.

94. **P1 - Should phone numbers be normalized to E.164 format?**

## 14. API and Integration Boundaries

95. **P0 - Is there an existing frontend/backend framework choice?**  
    The spec recommends REST but does not choose the stack.

96. **P0 - Should admin, tenant, expert, and customer APIs share one app/API or be separated by route namespace?**

97. **P0 - What API authentication method is required?**  
    Cookie sessions, JWT bearer tokens, or both?

98. **P1 - Are public APIs rate-limited per IP, customer, tenant, or endpoint?**

99. **P1 - Should internal notification APIs exist in MVP, or should notifications be triggered only from domain events?**

100. **P1 - Is an API contract/OpenAPI document required before implementation?**

## 15. Security, Privacy, and Compliance

101. **P0 - What privacy regime applies?**  
     GDPR, UK GDPR, India DPDP, HIPAA-like medical privacy, or another jurisdiction?

102. **P0 - Is the platform allowed to store health or sensitive appointment notes?**  
     If any tenant category is medical/clinic-related, requirements change significantly.

103. **P0 - What consent text is required for customer data and notifications?**

104. **P0 - What data deletion/anonymization rights must be supported?**

105. **P1 - Is two-factor authentication required for platform admins?**

106. **P1 - What are the lockout/throttling rules for failed login attempts?**

107. **P1 - Are uploaded images/files scanned or moderated?**

108. **P1 - What secrets management approach should be used?**

## 16. Non-Functional Requirements

109. **P0 - What are the expected MVP scale targets?**  
     Number of tenants, experts per tenant, bookings per day, concurrent users, and search requests per minute.

110. **P0 - What are the response time targets?**  
     For search, slot lookup, and booking confirmation.

111. **P1 - What uptime or availability target is expected for MVP?**

112. **P1 - What backup and restore requirements exist?**

113. **P1 - What observability tooling should be used?**  
     Logs, metrics, tracing, error reporting, alerting.

114. **P1 - What environments are required?**  
     Local, dev, staging, production, demo?

## 17. UI and UX Clarifications

115. **P0 - Are there brand guidelines or design references?**

116. **P0 - What is the desired customer booking path if an expert is optional?**  
     Select service first, select expert first, or let system choose earliest availability?

117. **P0 - Should users be able to book from search results directly?**

118. **P1 - Should the tenant admin calendar be day, week, month, or list-based in MVP?**

119. **P1 - Does the expert need a separate UI in MVP, or can expert views wait?**

120. **P1 - What accessibility standard should be targeted?**  
     For example, WCAG 2.1 AA.

121. **P1 - What languages/locales should the UI support in MVP?**

## 18. Operational and Support Questions

122. **P0 - Who handles customer support for booking problems?**  
     Platform, tenant, or both?

123. **P0 - Can platform admins edit or cancel tenant bookings?**

124. **P1 - Should there be internal notes visible only to admins/tenant staff?**

125. **P1 - Should failed bookings or slot conflicts be logged for support investigation?**

126. **P1 - Is manual booking creation by tenant staff required for MVP?**

## 19. Documentation and Quality

127. **P0 - What is the definition of done for MVP?**  
     Acceptance criteria are listed, but test expectations, deployment readiness, monitoring, and support readiness are not defined.

128. **P0 - What automated tests are required before launch?**  
     Unit, integration, API, end-to-end booking flow, concurrency tests, and permission tests.

129. **P1 - Should seed/demo data be provided?**

130. **P1 - Should there be developer-facing API docs and admin user guides?**

## 20. Specification Issues Found

1. **Text encoding issue:** Some curly quotes/apostrophes appear as mojibake in the source file. The source file should be normalized to UTF-8.

2. **Status mismatch:** Tenant statuses differ between sections: `active/inactive/pending/suspended` and `draft/active/inactive/suspended`.

3. **Customer identity ambiguity:** The spec says customer login or lightweight identity, but booking lookup, cancellation, history, and privacy depend on a firm decision.

4. **Branch ambiguity:** Branches are excluded from MVP but schema preparation is recommended. This needs a specific implementation decision to avoid later migration pain.

5. **Notification ambiguity:** WhatsApp is both a foundation and an MVP channel candidate. Whether real WhatsApp messages must send in MVP is unclear.

6. **Expert permissions ambiguity:** Experts are listed as active users with calendar controls, but expert UI may be a significant MVP expansion.

7. **Pending status ambiguity:** Booking is recommended as instant-confirmed, but `Pending` is included without a clear use case.

8. **Availability inheritance ambiguity:** Tenant operating hours, expert working hours, and availability rules are all mentioned, but precedence is not defined.

9. **Location model inconsistency:** `Location` is listed as a core entity, while tenant address fields are embedded directly in the suggested `Tenant` table.

10. **Security/compliance gap:** Privacy, consent, data deletion, sensitive notes, and jurisdiction-specific compliance are only lightly mentioned.

11. **Technical stack not chosen:** The spec is implementation-oriented but does not choose framework, database, auth approach, map provider, background job system, or deployment target.

12. **NFRs are qualitative:** Performance, scale, availability, backup, logging, and response-time targets need measurable values.

## 21. Recommended Defaults If Stakeholders Want to Start Quickly

These are suggested defaults to unblock development if no stronger product preference exists:

1. Use PostgreSQL with PostGIS for relational and geospatial data.
2. Use a shared database with strict `tenant_id` scoping and authorization checks.
3. Use UUID primary keys for public-facing entities.
4. Use customer guest booking with phone number plus booking reference for MVP.
5. Use instant booking confirmation; remove `Pending` from MVP unless approval is required.
6. Use one customer, one service, one expert, one slot per booking.
7. Use tenant timezone for all booking displays in MVP.
8. Use 15-minute slot intervals by default, configurable per tenant later.
9. Use 24-hour minimum notice and 30-day advance booking as configurable defaults.
10. Implement branch as a future concept, but introduce a `location` table now if migration risk is a concern.
11. Implement email notifications first, with WhatsApp schema/log foundation unless WABA credentials and approved templates are ready.
12. Keep expert login out of MVP unless stakeholders explicitly require it; tenant admins can manage expert schedules.
13. Snapshot service name, expert name, tenant name/location, duration, and displayed price on bookings.
14. Treat rescheduling as future unless customer self-service is required.
15. Require automated tests for RBAC, tenant isolation, slot generation, and concurrent booking prevention.
