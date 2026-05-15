import { PrismaClient, PlatformRole, TenantRole, TenantStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const [salon, wellness, clinic, consulting] = await Promise.all(
    [
      ['Salon', 'salon'],
      ['Wellness', 'wellness'],
      ['Clinic', 'clinic'],
      ['Consulting', 'consulting'],
    ].map(([name, slug]) =>
      prisma.category.upsert({
        where: { slug },
        update: { name, isActive: true },
        create: { name, slug, isActive: true },
      }),
    ),
  );

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const platformAdmin = await prisma.user.upsert({
    where: { email: 'platform.admin@neara.local' },
    update: { name: 'Platform Admin', platformRole: PlatformRole.platform_admin, passwordHash },
    create: {
      email: 'platform.admin@neara.local',
      name: 'Platform Admin',
      platformRole: PlatformRole.platform_admin,
      passwordHash,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'near-beauty-studio' },
    update: {
      name: 'Near Beauty Studio',
      bookingPrefix: 'NEAR',
      status: TenantStatus.active,
      primaryCategoryId: salon.id,
      timezone: 'Asia/Kolkata',
      description: 'A sample active tenant for local development booking flows.',
      activatedAt: new Date(),
    },
    create: {
      name: 'Near Beauty Studio',
      slug: 'near-beauty-studio',
      bookingPrefix: 'NEAR',
      status: TenantStatus.active,
      primaryCategoryId: salon.id,
      timezone: 'Asia/Kolkata',
      description: 'A sample active tenant for local development booking flows.',
      activatedAt: new Date(),
    },
  });

  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'tenant.admin@neara.local' },
    update: { name: 'Tenant Admin', passwordHash },
    create: {
      email: 'tenant.admin@neara.local',
      name: 'Tenant Admin',
      passwordHash,
    },
  });

  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: tenantAdmin.id } },
    update: { role: TenantRole.owner },
    create: { tenantId: tenant.id, userId: tenantAdmin.id, role: TenantRole.owner },
  });

  await prisma.location.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {
      tenantId: tenant.id,
      name: 'Main Studio',
      addressLine: '12 MG Road',
      locality: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      latitude: '12.978400',
      longitude: '77.640800',
      isPrimary: true,
      isActive: true,
    },
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: tenant.id,
      name: 'Main Studio',
      addressLine: '12 MG Road',
      locality: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      latitude: '12.978400',
      longitude: '77.640800',
      isPrimary: true,
      isActive: true,
    },
  });

  const service = await prisma.service.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'signature-haircut' } },
    update: {
      name: 'Signature Haircut',
      durationMinutes: 45,
      displayPriceAmount: '900.00',
      displayPriceCurrency: 'INR',
      isActive: true,
      isPublic: true,
    },
    create: {
      tenantId: tenant.id,
      name: 'Signature Haircut',
      slug: 'signature-haircut',
      durationMinutes: 45,
      displayPriceAmount: '900.00',
      displayPriceCurrency: 'INR',
      isActive: true,
      isPublic: true,
    },
  });

  const expert = await prisma.expert.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'ananya-rao' } },
    update: {
      displayName: 'Ananya Rao',
      shortBio: 'Senior stylist focused on clean, practical cuts.',
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      displayName: 'Ananya Rao',
      slug: 'ananya-rao',
      shortBio: 'Senior stylist focused on clean, practical cuts.',
      isActive: true,
    },
  });

  await prisma.expertService.upsert({
    where: { expertId_serviceId: { expertId: expert.id, serviceId: service.id } },
    update: { tenantId: tenant.id, isActive: true },
    create: { tenantId: tenant.id, expertId: expert.id, serviceId: service.id, isActive: true },
  });

  for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
    const existing = await prisma.availabilityRule.findFirst({
      where: { tenantId: tenant.id, expertId: expert.id, dayOfWeek, startLocalTime: '10:00' },
    });

    if (!existing) {
      await prisma.availabilityRule.create({
        data: {
          tenantId: tenant.id,
          expertId: expert.id,
          dayOfWeek,
          startLocalTime: '10:00',
          endLocalTime: '18:00',
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: platformAdmin.id,
      actorRole: 'platform_admin',
      entityType: 'tenant',
      entityId: tenant.id,
      action: 'seed',
      summary: 'Seeded local development tenant',
    },
  });

  console.log('Seed complete');
  console.log('Platform admin: platform.admin@neara.local / ChangeMe123!');
  console.log('Tenant admin: tenant.admin@neara.local / ChangeMe123!');
  console.log(`Categories: ${[salon, wellness, clinic, consulting].map((category) => category.slug).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
