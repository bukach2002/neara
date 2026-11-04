import { PrismaClient, PlatformRole, TenantRole, TenantStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────
type TenantSeed = {
  name: string;
  slug: string;
  bookingPrefix: string;
  categorySlug: string;
  description: string;
  timezone: string;
  countryCode: string;
  location: { name: string; addressLine: string; locality: string; city: string; state: string; postalCode: string; latitude: string; longitude: string };
  services: { name: string; slug: string; durationMinutes: number; price: string; currency: string }[];
  experts: { displayName: string; slug: string; shortBio: string }[];
  availability: { dayOfWeek: number; startLocalTime: string; endLocalTime: string }[];
};


// ── Vasai-Virar area tenant data generators ─────────────────
const vasaiAreas: AreaDef[] = [
  { locality: 'Nallasopara West', lat: 19.423, lng: 72.793, pincode: '401209' }
];

// Vasai-Virar business names
const vasaiBusinessNames: string[] = [
  'Sushi Glamour Studio And Academy'
];

const vasaiExpertFirst: string[] = [
  'Nisha',
];

const vasaiExpertLast: string[] = [
  'Soni',
];

// ── Pune-area tenant data generators ─────────────────────────
type AreaDef = { locality: string; lat: number; lng: number; pincode: string };

const puneAreas: AreaDef[] = [
  { locality: 'Indrayani Nagar, Bhosari', lat: 18.636, lng: 73.844, pincode: '411039' },
  { locality: 'Chaitanya Park, Bhosari', lat: 18.640, lng: 73.846, pincode: '411039' },
  { locality: 'Bhosari Gaon', lat: 18.648, lng: 73.850, pincode: '411039' },
  { locality: 'Moshi', lat: 18.665, lng: 73.840, pincode: '411039' },
  { locality: 'Dighi', lat: 18.619, lng: 73.848, pincode: '411034' },
  { locality: 'Pimple Gurav', lat: 18.610, lng: 73.835, pincode: '411061' },
  { locality: 'Sangvi', lat: 18.605, lng: 73.830, pincode: '411061' },
  { locality: 'Pimple Nilakh', lat: 18.600, lng: 73.820, pincode: '411060' },
  { locality: 'Pimple Saudagar', lat: 18.595, lng: 73.810, pincode: '411060' },
  { locality: 'Pimpri', lat: 18.622, lng: 73.805, pincode: '411018' },
  { locality: 'Chinchwad', lat: 18.628, lng: 73.785, pincode: '411019' },
  { locality: 'Thergaon', lat: 18.615, lng: 73.770, pincode: '411019' },
  { locality: 'Nigdi', lat: 18.650, lng: 73.770, pincode: '411044' },
  { locality: 'Akurdi', lat: 18.645, lng: 73.760, pincode: '411044' },
  { locality: 'Ravet', lat: 18.660, lng: 73.755, pincode: '412101' },
  { locality: 'Wakad', lat: 18.595, lng: 73.765, pincode: '411057' },
  { locality: 'Hinjawadi', lat: 18.585, lng: 73.740, pincode: '411057' },
];

const puneBusinessNames: string[] = [
 
];

const puneExpertFirst: string[] = [
  
];

const puneExpertLast: string[] = [
  
];

const saloonServices = [
  { name: 'Haircut & Style', slug: 'haircut-style', dur: 45, price: '499.00' },
  { name: 'Gents Haircut', slug: 'gents-haircut', dur: 30, price: '199.00' },
  { name: 'Facial Clean Up', slug: 'facial-clean-up', dur: 45, price: '599.00' },
  { name: 'Manicure & Pedicure', slug: 'manicure-pedicure', dur: 60, price: '699.00' },
  { name: 'Hair Colour', slug: 'hair-colour', dur: 90, price: '1999.00' },
  { name: 'Threading & Waxing', slug: 'threading-waxing', dur: 30, price: '299.00' },
  { name: 'Beard Trim & Shave', slug: 'beard-trim-shave', dur: 20, price: '149.00' },
  { name: 'Hair Straightening', slug: 'hair-straightening', dur: 120, price: '2999.00' },
  { name: 'Bridal Makeup', slug: 'bridal-makeup', dur: 120, price: '4999.00' },
  { name: 'Head Massage', slug: 'head-massage', dur: 20, price: '199.00' },
  { name: 'Hair Wash & Blow Dry', slug: 'hair-wash-blow-dry', dur: 30, price: '349.00' },
  { name: 'Spa Pedicure', slug: 'spa-pedicure', dur: 45, price: '499.00' },
  { name: 'Kids Haircut', slug: 'kids-haircut', dur: 20, price: '149.00' },
  { name: 'Root Touch Up', slug: 'root-touch-up', dur: 60, price: '1299.00' },
];

const wellnessServices = [
  { name: 'Full Body Massage', slug: 'full-body-massage', dur: 60, price: '999.00' },
  { name: 'Aromatherapy Massage', slug: 'aromatherapy-massage', dur: 60, price: '1299.00' },
  { name: 'Physiotherapy Session', slug: 'physiotherapy-session', dur: 45, price: '599.00' },
  { name: 'Steam & Sauna', slug: 'steam-sauna', dur: 30, price: '399.00' },
  { name: 'Facial & Clean Up', slug: 'facial-clean-up-w', dur: 45, price: '699.00' },
  { name: 'Yoga Session', slug: 'yoga-session', dur: 60, price: '349.00' },
  { name: 'Dental Checkup', slug: 'dental-checkup', dur: 30, price: '399.00' },
  { name: 'Skin Consultation', slug: 'skin-consultation', dur: 30, price: '499.00' },
  { name: 'Panchakarma Therapy', slug: 'panchakarma-therapy', dur: 90, price: '1999.00' },
  { name: 'Reflexology', slug: 'reflexology', dur: 45, price: '799.00' },
];

function mkAvail(from: number, to: number, start: string, end: string) {
  return Array.from({ length: to - from + 1 }, (_, i) => ({ dayOfWeek: from + i, startLocalTime: start, endLocalTime: end }));
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generatePuneTenants(): TenantSeed[] {
  const tenants: TenantSeed[] = [];

  for (let i = 0; i < 0; i++) {
    const area = puneAreas[i % puneAreas.length];
    const name = puneBusinessNames[i];
    const catSlug = i < 45 ? 'salon' : 'wellness';
    const servicePool = catSlug === 'wellness' ? wellnessServices : saloonServices;
    const numServices = 1 + (i % 3);
    const services = servicePool.slice(i % servicePool.length, (i % servicePool.length) + numServices);
    const numExperts = 1 + (i % 2);
    const experts = Array.from({ length: numExperts }, (_, ei) => ({
      displayName: `${pick(puneExpertFirst, i * 10 + ei)} ${pick(puneExpertLast, i * 7 + ei)}`,
      slug: slugify(`${pick(puneExpertFirst, i * 10 + ei)} ${pick(puneExpertLast, i * 7 + ei)}`),
      shortBio: catSlug === 'salon'
        ? `Experienced stylist with ${(ei + 3 + (i % 12))} years in hairdressing and beauty services.`
        : `Certified therapist with ${(ei + 2 + (i % 10))} years in wellness and holistic care.`,
    }));
    const startH = 9 + (i % 3);
    const prefix = `P${String(i + 1).padStart(2, '0')}`;

    tenants.push({
      name,
      slug: slugify(name) + '-' + String(i + 1),
      bookingPrefix: prefix,
      categorySlug: catSlug,
      description: `${name} — quality ${catSlug === 'salon' ? 'salon and grooming' : 'wellness and therapy'} services in ${area.locality}, Pune.`,
      timezone: 'Asia/Kolkata',
      countryCode: 'IN',
      location: {
        name: `${area.locality} Studio`,
        addressLine: `Shop ${i + 1}, ${['MG Road', 'Main Street', 'Market Lane', 'Station Road', 'College Road', 'Phase ' + (1 + (i % 3))][i % 6]}`,
        locality: area.locality,
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: area.pincode,
        latitude: (area.lat + (i % 3) * 0.002 - 0.002).toFixed(6),
        longitude: (area.lng + (Math.floor(i / 3) % 3) * 0.003 - 0.003).toFixed(6),
      },
      services: services.map((s) => ({
        name: s.name,
        slug: slugify(s.name) + '-' + prefix.toLowerCase(),
        durationMinutes: s.dur,
        price: s.price,
        currency: 'INR',
      })),
      experts,
      availability: [1, 2, 3, 4, 5, 6].map((d) => ({
        dayOfWeek: d,
        startLocalTime: `${startH}:00`,
        endLocalTime: `${startH + 9}:00`,
      })),
    });
  }

  return tenants;
}

function generateVasaiTenants(): TenantSeed[] {
  const tenants: TenantSeed[] = [];

  for (let i = 0; i < 0; i++) {
    const area = vasaiAreas[i % vasaiAreas.length];
    const name = vasaiBusinessNames[i];
    const catSlug = i < 92 ? 'salon' : 'wellness';
    const servicePool = catSlug === 'wellness' ? wellnessServices : saloonServices;
    const numServices = 1 + ((i + 7) % 3);
    const services = servicePool.slice((i + 3) % servicePool.length, ((i + 3) % servicePool.length) + numServices);
    const numExperts = 1 + ((i + 5) % 2);
    const experts = Array.from({ length: numExperts }, (_, ei) => ({
      displayName: `${pick(vasaiExpertFirst, i * 13 + ei * 7)} ${pick(vasaiExpertLast, i * 11 + ei * 5)}`,
      slug: slugify(`${pick(vasaiExpertFirst, i * 13 + ei * 7)} ${pick(vasaiExpertLast, i * 11 + ei * 5)}`),
      shortBio: catSlug === 'salon'
        ? `Professional stylist with ${(ei + 3 + ((i * 3) % 15))} years of experience in the Vasai-Virar region.`
        : `Certified wellness professional with ${(ei + 2 + ((i * 5) % 12))} years in holistic therapy and care.`,
    }));
    const startH = 9 + ((i * 2) % 4);

    tenants.push({
      name,
      slug: slugify(name) + '-v' + String(i + 1),
      bookingPrefix: `V${String(i + 1).padStart(3, '0')}`,
      categorySlug: catSlug,
      description: `${name} — reliable ${catSlug === 'salon' ? 'salon and grooming' : 'wellness and therapy'} services in ${area.locality}, Vasai-Virar region.`,
      timezone: 'Asia/Kolkata',
      countryCode: 'IN',
      location: {
        name: `${area.locality} Studio`,
        addressLine: `Shop ${(i % 50) + 1}, ${['Bazar Peth', 'Station Road', 'Achole Road', 'Agashi Road', 'Virar Highway', 'NH 48', 'Vasai Creek Road', 'Parnaka', 'Shivaji Path', 'Police Station Road'][i % 10]}`,
        locality: area.locality,
        city: ['Vasai', 'Vasai', 'Vasai', 'Vasai', 'Virar', 'Virar', 'Virar', 'Nallasopara', 'Nallasopara', 'Vasai'][i % 10],
        state: 'Maharashtra',
        postalCode: area.pincode,
        latitude: (area.lat + ((i * 3) % 5) * 0.0015 - 0.003).toFixed(6),
        longitude: (area.lng + ((i * 7) % 4) * 0.002 - 0.004).toFixed(6),
      },
      services: services.map((s) => ({
        name: s.name,
        slug: slugify(s.name) + '-v' + String(i + 1),
        durationMinutes: s.dur,
        price: s.price,
        currency: 'INR',
      })),
      experts,
      availability: [1, 2, 3, 4, 5, 6].map((d) => ({
        dayOfWeek: d,
        startLocalTime: `${startH}:00`,
        endLocalTime: `${startH + 9}:00`,
      })),
    });
  }

  return tenants;
}

const puneTenants = generatePuneTenants();
const vasaiTenants = generateVasaiTenants();
const allTenants =[...puneTenants, ...vasaiTenants];

async function upsertCategory(name: string, slug: string) {
  return prisma.category.upsert({
    where: { slug },
    update: { name, isActive: true },
    create: { name, slug, isActive: true },
  });
}

async function main() {
  // ── Categories ───────────────────────────────────────────────
  const [salon, wellness, clinic, consulting] = await Promise.all([
    upsertCategory('Salon', 'salon'),
    upsertCategory('Wellness', 'wellness'),
    upsertCategory('Clinic', 'clinic'),
    upsertCategory('Consulting', 'consulting'),
  ]);

  const categoryBySlug: Record<string, typeof salon> = { salon, wellness, clinic, consulting };

  // ── Admin users ──────────────────────────────────────────────
 // const tenantPasswordHash = await bcrypt.hash('EOjz4bphEDvoRtyp!', 12);
  const adminPasswordHash = await bcrypt.hash('D5xzJmymKWBA9DETjUSUe6YxCXHDLL6', 12);

  const platformAdmin = await prisma.user.upsert({
    where: { email: 'platform.admin@tradunio.com' },
    update: { name: 'Platform Admin', platformRole: PlatformRole.platform_admin, passwordHash:adminPasswordHash },
    create: {
      email: 'admin@tradunio.com',
      name: 'Platform Admin',
      platformRole: PlatformRole.platform_admin,
      passwordHash:adminPasswordHash,
    },
  });
  /*
  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'tenant.admin@neara.local' },
    update: { name: 'Tenant Admin', tenantPasswordHash },
    create: {
      email: 'tenant.admin@neara.local',
      name: 'Tenant Admin',
        passwordHash: tenantPasswordHash,
    },
  });
*/
  // ── Clean existing data ──────────────────────────────────────
  await prisma.session.deleteMany({});
  await prisma.otpToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.expertService.deleteMany({});
  await prisma.availabilityRule.deleteMany({});
  await prisma.availabilityException.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.bookingAttemptLog.deleteMany({});
  await prisma.uploadedAsset.deleteMany({});
  await prisma.expert.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.notificationLog.deleteMany({});
  await prisma.tenantMembership.deleteMany({});
  await prisma.tenant.deleteMany({});

  // ── Seed all tenants ─────────────────────────────────────────
  for (const seed of allTenants) {
    const category = categoryBySlug[seed.categorySlug];
    if (!category) throw new Error(`Unknown category: ${seed.categorySlug}`);

    const tenant = await prisma.tenant.create({
      data: {
        name: seed.name,
        slug: seed.slug,
        bookingPrefix: seed.bookingPrefix,
        status: TenantStatus.active,
        primaryCategoryId: category.id,
        timezone: seed.timezone,
        description: seed.description,
        activatedAt: new Date(),
      },
    });

    await prisma.location.create({
      data: {
        tenantId: tenant.id,
        name: seed.location.name,
        addressLine: seed.location.addressLine,
        locality: seed.location.locality,
        city: seed.location.city,
        state: seed.location.state,
        postalCode: seed.location.postalCode,
        countryCode: seed.countryCode,
        latitude: seed.location.latitude,
        longitude: seed.location.longitude,
        isPrimary: true,
        isActive: true,
      },
    });

    const serviceIds: string[] = [];
    for (const svc of seed.services) {
      const service = await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: svc.name,
          slug: svc.slug,
          durationMinutes: svc.durationMinutes,
          displayPriceAmount: svc.price,
          displayPriceCurrency: svc.currency,
          isActive: true,
          isPublic: true,
        },
      });
      serviceIds.push(service.id);
    }

    for (const exp of seed.experts) {
      const expert = await prisma.expert.create({
        data: {
          tenantId: tenant.id,
          displayName: exp.displayName,
          slug: exp.slug,
          shortBio: exp.shortBio,
          isActive: true,
        },
      });

      for (const serviceId of serviceIds) {
        await prisma.expertService.create({
          data: { tenantId: tenant.id, expertId: expert.id, serviceId, isActive: true },
        });
      }
    }

    const firstExpert = await prisma.expert.findFirst({ where: { tenantId: tenant.id } });
    if (firstExpert) {
      for (const slot of seed.availability) {
        await prisma.availabilityRule.create({
          data: {
            tenantId: tenant.id,
            expertId: firstExpert.id,
            dayOfWeek: slot.dayOfWeek,
            startLocalTime: slot.startLocalTime,
            endLocalTime: slot.endLocalTime,
          },
        });
      }
    }

   // await prisma.tenantMembership.create({
   //   data: { tenantId: tenant.id, userId: tenantAdmin.id, role: TenantRole.owner },
  //  });

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: platformAdmin.id,
        actorRole: 'platform_admin',
        entityType: 'tenant',
        entityId: tenant.id,
        action: 'seed',
        summary: `Seeded tenant: ${seed.name}`,
      },
    });
  }

 // const londonCount = londonTenants.length;
  const puneCount = puneTenants.length;
  const vasaiCount = vasaiTenants.length;
  console.log('Seed complete');
 // console.log(`Platform admin: platform.admin@neara.local / ChangeMe123!`);
 // console.log(`Tenant admin: tenant.admin@neara.local / ChangeMe123!`);
 // console.log(`Seeded ${londonCount} London + ${puneCount} Pune + ${vasaiCount} Vasai-Virar = ${allTenants.length} total`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
