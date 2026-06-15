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

// ── London tenants (static) ──────────────────────────────────
const londonTenants: TenantSeed[] = [
  {
    name: 'KT Hair & Beauty', slug: 'kt-hair-beauty', bookingPrefix: 'KT_HB', categorySlug: 'salon',
    description: 'A friendly hair and beauty salon offering cuts, colouring, and styling for all the family in Greenford.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Greenford Salon', addressLine: '112 Ruislip Road', locality: 'Greenford', city: 'London', state: 'Greater London', postalCode: 'UB6 9QH', latitude: '51.542500', longitude: '-0.348000' },
    services: [
      { name: 'Ladies Haircut & Blow Dry', slug: 'ladies-haircut-blow-dry', durationMinutes: 45, price: '35.00', currency: 'GBP' },
      { name: 'Gents Haircut', slug: 'gents-haircut', durationMinutes: 30, price: '18.00', currency: 'GBP' },
    ],
    experts: [
      { displayName: 'Kiran Taylor', slug: 'kiran-taylor', shortBio: 'Owner-stylist with 12 years experience in precision cutting and colouring.' },
    ],
    availability: mkAvail(1, 6, '09:00', '18:00'),
  },
  {
    name: 'Maru Barber Shop', slug: 'maru-barber-shop', bookingPrefix: 'MARU', categorySlug: 'salon',
    description: 'Traditional barber shop serving the Greenford community with classic cuts and hot towel shaves.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'The Broadway Shop', addressLine: '6 The Broadway', locality: 'Greenford', city: 'London', state: 'Greater London', postalCode: 'UB6 9PR', latitude: '51.544000', longitude: '-0.346500' },
    services: [
      { name: 'Classic Haircut', slug: 'classic-haircut', durationMinutes: 30, price: '15.00', currency: 'GBP' },
      { name: 'Hot Towel Shave', slug: 'hot-towel-shave', durationMinutes: 30, price: '22.00', currency: 'GBP' },
    ],
    experts: [{ displayName: 'Maru Patel', slug: 'maru-patel', shortBio: 'Master barber with 20 years experience in traditional and modern styles.' }],
    availability: mkAvail(1, 6, '09:00', '17:30'),
  },
  {
    name: 'Mirror Mirror', slug: 'mirror-mirror', bookingPrefix: 'MIRR', categorySlug: 'salon',
    description: 'Full-service hair and beauty salon offering cuts, colour, nails, and aesthetic treatments in Greenford.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Oldfield Lane Salon', addressLine: '376 Oldfield Lane North', locality: 'Greenford', city: 'London', state: 'Greater London', postalCode: 'UB6 8PU', latitude: '51.549000', longitude: '-0.341000' },
    services: [
      { name: 'Cut & Finish', slug: 'cut-finish', durationMinutes: 45, price: '32.00', currency: 'GBP' },
      { name: 'Gel Manicure', slug: 'gel-manicure', durationMinutes: 45, price: '28.00', currency: 'GBP' },
    ],
    experts: [
      { displayName: 'Claire Johnson', slug: 'claire-johnson', shortBio: 'Senior stylist passionate about creative colour and precision cuts.' },
    ],
    availability: mkAvail(1, 6, '09:30', '18:00'),
  },
  {
    name: 'Split Enz Hair and Beauty', slug: 'split-enz-hair-beauty', bookingPrefix: 'SPLT', categorySlug: 'salon',
    description: 'Community hair and beauty salon in Perivale offering affordable cuts, colour, and beauty treatments.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Medway Parade Salon', addressLine: '22 Medway Parade', locality: 'Perivale', city: 'London', state: 'Greater London', postalCode: 'UB6 8HR', latitude: '51.536000', longitude: '-0.325000' },
    services: [
      { name: 'Wash Cut & Blow Dry', slug: 'wash-cut-blow-dry', durationMinutes: 45, price: '30.00', currency: 'GBP' },
    ],
    experts: [{ displayName: 'Emma Richards', slug: 'emma-richards', shortBio: 'Friendly stylist dedicated to giving every client a look they love.' }],
    availability: [...mkAvail(1, 5, '10:00', '17:00'), { dayOfWeek: 6, startLocalTime: '09:00', endLocalTime: '15:00' }],
  },
  {
    name: 'Zaira Rose Salon', slug: 'zaira-rose-salon', bookingPrefix: 'ZRS_', categorySlug: 'salon',
    description: 'Boutique hair salon in Perivale specialising in men\'s haircuts, beard grooming, and traditional barbering.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Aintree Road Studio', addressLine: '23 Aintree Road', locality: 'Perivale', city: 'London', state: 'Greater London', postalCode: 'UB6 7LA', latitude: '51.538500', longitude: '-0.328000' },
    services: [
      { name: 'Men\'s Haircut', slug: 'mens-haircut', durationMinutes: 30, price: '16.00', currency: 'GBP' },
    ],
    experts: [{ displayName: 'Zaira Ahmed', slug: 'zaira-ahmed', shortBio: 'Barber and salon owner with a keen eye for detail and modern styles.' }],
    availability: mkAvail(1, 6, '09:00', '18:00'),
  },
  {
    name: 'Princess Beauty Salon', slug: 'princess-beauty-salon', bookingPrefix: 'PB_S', categorySlug: 'salon',
    description: 'Nail and beauty salon on Greenford Broadway offering manicures, pedicures, waxing, and brow treatments.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Broadway Beauty Lounge', addressLine: 'Unit 3, 6 The Broadway', locality: 'Greenford', city: 'London', state: 'Greater London', postalCode: 'UB6 9PR', latitude: '51.544000', longitude: '-0.346800' },
    services: [
      { name: 'Classic Manicure', slug: 'classic-manicure', durationMinutes: 30, price: '22.00', currency: 'GBP' },
      { name: 'Spa Pedicure', slug: 'spa-pedicure', durationMinutes: 45, price: '32.00', currency: 'GBP' },
    ],
    experts: [{ displayName: 'Priya Singh', slug: 'priya-singh', shortBio: 'Nail technician and beauty therapist with a passion for perfection.' }],
    availability: mkAvail(1, 6, '10:00', '18:00'),
  },
  {
    name: 'Studio 44 Hair & Nail', slug: 'studio-44-hair-nail', bookingPrefix: 'ST44', categorySlug: 'salon',
    description: 'Hair and nail salon in Northolt providing quality cuts, colour, gel nails, and waxing services.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Northolt Studio', addressLine: '44 Church Road', locality: 'Northolt', city: 'London', state: 'Greater London', postalCode: 'UB5 5AB', latitude: '51.548500', longitude: '-0.368000' },
    services: [
      { name: 'Haircut & Style', slug: 'haircut-style', durationMinutes: 45, price: '28.00', currency: 'GBP' },
    ],
    experts: [{ displayName: 'Diana Cooper', slug: 'diana-cooper', shortBio: 'Senior hair and nail stylist with 8 years experience in the industry.' }],
    availability: mkAvail(1, 6, '09:30', '17:30'),
  },
  {
    name: 'Uban Spa Studio', slug: 'uban-spa-studio', bookingPrefix: 'UBAN', categorySlug: 'wellness',
    description: 'Holistic spa and wellness studio in Greenford offering massages, facials, waxing, and relaxation therapies.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Bilton Road Spa', addressLine: '20 Bilton Road', locality: 'Greenford', city: 'London', state: 'Greater London', postalCode: 'UB6 7DS', latitude: '51.540000', longitude: '-0.322500' },
    services: [
      { name: 'Swedish Full Body Massage', slug: 'swedish-full-body-massage', durationMinutes: 60, price: '55.00', currency: 'GBP' },
      { name: 'Deep Tissue Massage', slug: 'deep-tissue-massage', durationMinutes: 60, price: '65.00', currency: 'GBP' },
    ],
    experts: [
      { displayName: 'Ursula Banks', slug: 'ursula-banks', shortBio: 'Qualified massage therapist specialising in deep tissue and sports massage.' },
    ],
    availability: [...mkAvail(1, 5, '10:00', '19:00'), { dayOfWeek: 6, startLocalTime: '09:00', endLocalTime: '17:00' }],
  },
  {
    name: 'Mikel\'s Hairdresser', slug: 'mikels-hairdresser', bookingPrefix: 'MKLS', categorySlug: 'salon',
    description: 'Family-run barbershop in Perivale offering traditional and contemporary haircuts for men and boys.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Perivale Barbers', addressLine: '285 Ruislip Road', locality: 'Perivale', city: 'London', state: 'Greater London', postalCode: 'UB6 9QH', latitude: '51.539000', longitude: '-0.320000' },
    services: [
      { name: 'Standard Haircut', slug: 'standard-haircut', durationMinutes: 25, price: '14.00', currency: 'GBP' },
    ],
    experts: [{ displayName: 'Mikel Garcia', slug: 'mikel-garcia', shortBio: 'Owner-barber with a friendly approach and over 15 years of trade.' }],
    availability: [{ dayOfWeek: 1, startLocalTime: '10:00', endLocalTime: '17:00' }, ...mkAvail(2, 5, '09:00', '17:30'), { dayOfWeek: 6, startLocalTime: '08:30', endLocalTime: '15:00' }],
  },
  {
    name: 'Freddy\'s London Ltd', slug: 'freddys-london', bookingPrefix: 'FRED', categorySlug: 'salon',
    description: 'Premium hair salon in Perivale offering high-quality cuts, colour, and bridal hair services.',
    timezone: 'Europe/London', countryCode: 'GB',
    location: { name: 'Bilton Road Salon', addressLine: '42B Bilton Road', locality: 'Perivale', city: 'London', state: 'Greater London', postalCode: 'UB6 7DH', latitude: '51.539500', longitude: '-0.321500' },
    services: [
      { name: 'Premium Cut & Finish', slug: 'premium-cut-finish', durationMinutes: 60, price: '45.00', currency: 'GBP' },
    ],
    experts: [{ displayName: 'Freddy Clarke', slug: 'freddy-clarke', shortBio: 'Creative director and colour specialist with editorial experience.' }],
    availability: [{ dayOfWeek: 1, startLocalTime: '11:00', endLocalTime: '19:00' }, ...mkAvail(2, 5, '09:00', '18:00'), { dayOfWeek: 6, startLocalTime: '09:00', endLocalTime: '17:00' }],
  },
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
  'Style Hub Salon & Spa', 'Glow & Grace Beauty Salon', 'Royal Cuts Barbershop', 'Natraj Hair & Beauty',
  'Shree Sai Beauty Parlour', 'Lavender Beauty Lounge', 'Shagun Hair Studio', 'Impression Unisex Salon',
  'Rang De Beauty Salon', 'Classic Looks Salon', 'Mohan Barber & Style', 'Veer Barber Shop',
  'Trendy Cuts Salon', 'Green Trends Unisex', 'Sana Beauty & Skin Care', 'Pari Beauty Salon',
  'Shivam Hair Dresser', 'Blush Beauty Studio', 'Anjali Beauty Parlour', 'Deccan Barbers & Style',
  'Pure Glow Salon', 'Ruturaj Hair Cutting', 'Keshav Saree & Beauty', 'Akruti Beauty Salon',
  'Shree Datta Hair Dresser', 'Kala Niketan Beauty Parlour', 'Venus Unisex Salon', 'Apna Barber Shop',
  'Trimurti Beauty Salon', 'Dream Cuts Salon', 'Milan Beauty Studio', 'Riddhi Siddhi Salon',
  'Chandan Hair Dresser', 'Reba Hair & Beauty', 'Sai Kripa Beauty Parlour', 'Adinath Unisex Salon',
  'Aarya Beauty Lounge', 'New Fashion Barber Shop', 'Arpita Beauty Clinic', 'Swasthya Physiotherapy Clinic',
  'Nandanvan Spa & Wellness', 'Om Physiotherapy & Rehab', 'Sai Dental Clinic & Wellness',
  'Drushti Skin & Hair Clinic', 'Pranayam Wellness Studio', 'Sahaj Spa & Massage',
  'Heal Easy Physiotherapy', 'Ayurjeevan Spa & Wellness', 'Smile Care Dental Clinic', 'Yoga Prana Wellness',
];

const puneExpertFirst: string[] = [
  'Rajesh', 'Sunita', 'Rohan', 'Priya', 'Amit', 'Neha', 'Sachin', 'Kavita', 'Vijay', 'Anita',
  'Suresh', 'Maya', 'Deepak', 'Pooja', 'Manish', 'Rekha', 'Ganesh', 'Shweta', 'Nitin', 'Asha',
];

const puneExpertLast: string[] = [
  'Sharma', 'Patil', 'Joshi', 'Kulkarni', 'Deshmukh', 'More', 'Jadhav', 'Gawande', 'Bhosale', 'Kadam',
  'Shinde', 'Pawar', 'Sathe', 'Apte', 'Gokhale', 'Dixit', 'Phadke', 'Mane', 'Dalvi', 'Mahajan',
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

  for (let i = 0; i < 50; i++) {
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

const puneTenants = generatePuneTenants();
const allTenants = [...londonTenants, ...puneTenants];

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

  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'tenant.admin@neara.local' },
    update: { name: 'Tenant Admin', passwordHash },
    create: {
      email: 'tenant.admin@neara.local',
      name: 'Tenant Admin',
      passwordHash,
    },
  });

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

    await prisma.tenantMembership.create({
      data: { tenantId: tenant.id, userId: tenantAdmin.id, role: TenantRole.owner },
    });

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

  const londonCount = londonTenants.length;
  const puneCount = puneTenants.length;
  console.log('Seed complete');
  console.log(`Platform admin: platform.admin@neara.local / ChangeMe123!`);
  console.log(`Tenant admin: tenant.admin@neara.local / ChangeMe123!`);
  console.log(`Seeded ${londonCount} London tenants + ${puneCount} Pune tenants = ${allTenants.length} total`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
