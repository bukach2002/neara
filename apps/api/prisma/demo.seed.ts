import 'dotenv/config';
import { PlatformRole, PrismaClient, TenantRole, TenantStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Creates the App Review demo accounts without touching any other data.
 *
 * Unlike prisma/seed.ts, this script never deletes rows and is safe to re-run:
 * every record is matched by a natural key and updated in place. Credentials are
 * required from the environment so no production password lives in the repo.
 *
 *   DEMO_STUDIO_EMAIL=... DEMO_STUDIO_PASSWORD=... \
 *   DEMO_CUSTOMER_EMAIL=... DEMO_CUSTOMER_PASSWORD=... \
 *   npm --workspace apps/api run db:seed:demo
 */

const prisma = new PrismaClient();

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Set it in the shell or apps/api/.env before running db:seed:demo.`,
    );
  }
  return value;
}

function checkPassword(label: string, password: string, email: string) {
  if (password.length < 12) {
    throw new Error(`${label} must be at least 12 characters`);
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error(`${label} must contain at least one letter and one number`);
  }
  const localPart = email.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
    throw new Error(`${label} must not contain the email address`);
  }
}

const STUDIO_EMAIL = requireEnv('DEMO_STUDIO_EMAIL').toLowerCase();
const STUDIO_PASSWORD = requireEnv('DEMO_STUDIO_PASSWORD');
const CUSTOMER_EMAIL = requireEnv('DEMO_CUSTOMER_EMAIL').toLowerCase();
const CUSTOMER_PASSWORD = requireEnv('DEMO_CUSTOMER_PASSWORD');

const STUDIO_NAME = process.env.DEMO_STUDIO_NAME?.trim() || 'Demo Studio Neara';
const STUDIO_SLUG = process.env.DEMO_STUDIO_SLUG?.trim().toLowerCase() || 'demo-studio';
const BOOKING_PREFIX = process.env.DEMO_BOOKING_PREFIX?.trim().toUpperCase() || 'DEMO';
const STUDIO_PHONE = process.env.DEMO_STUDIO_PHONE?.trim() || '+91 98765 43210';
const STUDIO_DESCRIPTION =
  'A demo salon in Baner, Pune, used to review the Neara booking experience end to end.';

checkPassword('DEMO_STUDIO_PASSWORD', STUDIO_PASSWORD, STUDIO_EMAIL);
checkPassword('DEMO_CUSTOMER_PASSWORD', CUSTOMER_PASSWORD, CUSTOMER_EMAIL);

if (STUDIO_EMAIL === CUSTOMER_EMAIL) {
  throw new Error('DEMO_STUDIO_EMAIL and DEMO_CUSTOMER_EMAIL must be different');
}

const services = [
  { name: 'Signature Haircut', slug: 'signature-haircut', durationMinutes: 45, price: '599.00' },
  { name: 'Hair Colour', slug: 'hair-colour', durationMinutes: 90, price: '2499.00' },
  { name: 'Facial Clean Up', slug: 'facial-clean-up', durationMinutes: 45, price: '899.00' },
];

const experts = [
  { displayName: 'Aarav Mehta', slug: 'aarav-mehta', shortBio: 'Senior stylist, 9 years of experience.' },
  { displayName: 'Priya Sharma', slug: 'priya-sharma', shortBio: 'Colour specialist and skin therapist.' },
];

async function seedCategory() {
  return prisma.category.upsert({
    where: { slug: 'salon' },
    update: { name: 'Salon', isActive: true },
    create: { name: 'Salon', slug: 'salon', isActive: true },
  });
}

async function assertTenantIsOurs(studioUserId: string | undefined) {
  const existing = await prisma.tenant.findUnique({ where: { slug: STUDIO_SLUG } });

  if (existing) {
    const membership = studioUserId
      ? await prisma.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: existing.id, userId: studioUserId } },
        })
      : null;

    if (!membership) {
      throw new Error(
        `The page address "${STUDIO_SLUG}" already belongs to another business. ` +
          'Set DEMO_STUDIO_SLUG to an unused address instead of taking it over.',
      );
    }
  }

  const prefixOwner = await prisma.tenant.findUnique({ where: { bookingPrefix: BOOKING_PREFIX } });
  if (prefixOwner && prefixOwner.id !== existing?.id) {
    throw new Error(
      `Booking prefix "${BOOKING_PREFIX}" is already used by another business. ` +
        'Set DEMO_BOOKING_PREFIX to an unused prefix.',
    );
  }
}

async function assertCustomerIsNotStaff(existingCustomerId: string | undefined) {
  if (!existingCustomerId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: existingCustomerId },
    select: { platformRole: true, memberships: { select: { id: true }, take: 1 } },
  });

  if (user?.platformRole === PlatformRole.platform_admin || (user?.memberships.length ?? 0) > 0) {
    throw new Error(
      `DEMO_CUSTOMER_EMAIL (${CUSTOMER_EMAIL}) belongs to a staff or admin account. Use a different address.`,
    );
  }
}

async function main() {
  const now = new Date();
  const [studioPasswordHash, customerPasswordHash] = await Promise.all([
    bcrypt.hash(STUDIO_PASSWORD, 12),
    bcrypt.hash(CUSTOMER_PASSWORD, 12),
  ]);

  const category = await seedCategory();

  const existingStudio = await prisma.user.findUnique({ where: { email: STUDIO_EMAIL } });
  if (existingStudio?.platformRole === PlatformRole.platform_admin) {
    throw new Error(
      `DEMO_STUDIO_EMAIL (${STUDIO_EMAIL}) is a platform admin. Use a separate business address.`,
    );
  }
  await assertTenantIsOurs(existingStudio?.id);

  const studioUser = await prisma.user.upsert({
    where: { email: STUDIO_EMAIL },
    update: {
      name: 'Demo Studio Owner',
      passwordHash: studioPasswordHash,
      status: UserStatus.active,
      emailVerifiedAt: existingStudio?.emailVerifiedAt ?? now,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: STUDIO_EMAIL,
      name: 'Demo Studio Owner',
      passwordHash: studioPasswordHash,
      status: UserStatus.active,
      emailVerifiedAt: now,
    },
  });

  const existingCustomer = await prisma.user.findUnique({ where: { email: CUSTOMER_EMAIL } });
  await assertCustomerIsNotStaff(existingCustomer?.id);

  const customerUser = await prisma.user.upsert({
    where: { email: CUSTOMER_EMAIL },
    update: {
      name: 'Demo Customer',
      passwordHash: customerPasswordHash,
      status: UserStatus.active,
      emailVerifiedAt: existingCustomer?.emailVerifiedAt ?? now,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: CUSTOMER_EMAIL,
      name: 'Demo Customer',
      passwordHash: customerPasswordHash,
      status: UserStatus.active,
      emailVerifiedAt: now,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: STUDIO_SLUG },
    update: {
      name: STUDIO_NAME,
      status: TenantStatus.active,
      primaryCategoryId: category.id,
      timezone: 'Asia/Kolkata',
      description: STUDIO_DESCRIPTION,
      publicEmail: STUDIO_EMAIL,
      publicPhone: STUDIO_PHONE,
      activatedAt: now,
      archivedAt: null,
    },
    create: {
      name: STUDIO_NAME,
      slug: STUDIO_SLUG,
      bookingPrefix: BOOKING_PREFIX,
      status: TenantStatus.active,
      primaryCategoryId: category.id,
      timezone: 'Asia/Kolkata',
      description: STUDIO_DESCRIPTION,
      publicEmail: STUDIO_EMAIL,
      publicPhone: STUDIO_PHONE,
      activatedAt: now,
    },
  });

  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: studioUser.id } },
    update: { role: TenantRole.owner },
    create: { tenantId: tenant.id, userId: studioUser.id, role: TenantRole.owner },
  });

  const locationData = {
    name: 'Baner Studio',
    addressLine: '1st Floor, 12 Baner Road',
    locality: 'Baner',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411045',
    countryCode: 'IN',
    latitude: '18.559000',
    longitude: '73.786800',
    isPrimary: true,
    isActive: true,
    archivedAt: null,
  };

  const existingLocation = await prisma.location.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });

  if (existingLocation) {
    await prisma.location.update({ where: { id: existingLocation.id }, data: locationData });
  } else {
    await prisma.location.create({ data: { tenantId: tenant.id, ...locationData } });
  }

  const serviceRecords = [];
  for (const service of services) {
    serviceRecords.push(
      await prisma.service.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: service.slug } },
        update: {
          name: service.name,
          durationMinutes: service.durationMinutes,
          displayPriceAmount: service.price,
          displayPriceCurrency: 'INR',
          isActive: true,
          isPublic: true,
          archivedAt: null,
        },
        create: {
          tenantId: tenant.id,
          name: service.name,
          slug: service.slug,
          durationMinutes: service.durationMinutes,
          displayPriceAmount: service.price,
          displayPriceCurrency: 'INR',
          isActive: true,
          isPublic: true,
        },
      }),
    );
  }

  const expertRecords = [];
  for (const expert of experts) {
    expertRecords.push(
      await prisma.expert.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: expert.slug } },
        update: {
          displayName: expert.displayName,
          shortBio: expert.shortBio,
          isActive: true,
          archivedAt: null,
        },
        create: {
          tenantId: tenant.id,
          displayName: expert.displayName,
          slug: expert.slug,
          shortBio: expert.shortBio,
          isActive: true,
        },
      }),
    );
  }

  for (const expert of expertRecords) {
    for (const service of serviceRecords) {
      await prisma.expertService.upsert({
        where: { expertId_serviceId: { expertId: expert.id, serviceId: service.id } },
        update: { isActive: true },
        create: { tenantId: tenant.id, expertId: expert.id, serviceId: service.id },
      });
    }
  }

  // AvailabilityRule has no natural key, so replace only this demo studio's rules.
  const expertIds = expertRecords.map((expert) => expert.id);
  await prisma.availabilityRule.deleteMany({
    where: { tenantId: tenant.id, expertId: { in: expertIds } },
  });
  await prisma.availabilityRule.createMany({
    data: expertIds.flatMap((expertId) =>
      [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        tenantId: tenant.id,
        expertId,
        dayOfWeek,
        startLocalTime: '10:00',
        endLocalTime: '19:00',
      })),
    ),
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: studioUser.id,
      actorRole: 'tenant_admin',
      entityType: 'tenant',
      entityId: tenant.id,
      action: 'demo.seed',
      summary: `Demo studio and review accounts seeded for ${STUDIO_NAME}`,
    },
  });

  console.log('Demo seed complete — no existing rows were deleted.');
  console.log(`  studio page : /tenants/${tenant.slug} (tenant ${tenant.id})`);
  console.log(`  services    : ${serviceRecords.map((service) => service.name).join(', ')}`);
  console.log(`  experts     : ${expertRecords.map((expert) => expert.displayName).join(', ')}`);
  console.log(`  studio login: ${studioUser.email} (tenant owner)`);
  console.log(`  customer    : ${customerUser.email}`);
  console.log(`  passwords   : taken from DEMO_STUDIO_PASSWORD and DEMO_CUSTOMER_PASSWORD`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
