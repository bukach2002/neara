import { PublicService } from './public.service';

function tenant(id: string, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    logoUrl: null,
    primaryCategory: { id: 'category-1', name: 'Beauty', slug: 'beauty', description: null, isActive: true },
    locations: [
      {
        id: `location-${id}`,
        name: 'Main',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        addressLine: '12 Main Road',
        latitude: '12.971600',
        longitude: '77.594600',
      },
    ],
    services: [{ id: `service-${id}`, name: 'Haircut', durationMinutes: 45, displayPriceAmount: null, displayPriceCurrency: 'INR' }],
    _count: { experts: 1, services: 1 },
  };
}

function setup() {
  const prisma = {
    $queryRaw: jest.fn(),
    tenant: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue('maps-key') };
  const service = new PublicService(prisma as never, config as never);
  return { config, prisma, service };
}

describe('PublicService search', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an empty payload without hydrating tenants when no ranked rows match', async () => {
    const { prisma, service } = setup();
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.searchTenants({ keyword: 'zzz' })).resolves.toEqual({
      items: [],
      meta: { radiusKm: 10, distanceUnit: 'km', launchCountry: 'IN' },
    });
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });

  it('hydrates ranked tenant ids and preserves database search order', async () => {
    const { prisma, service } = setup();
    prisma.$queryRaw.mockResolvedValue([
      { id: 'tenant-b', distanceKm: 1.2, textScore: 0.9 },
      { id: 'tenant-a', distanceKm: 2.5, textScore: 0.7 },
    ]);
    prisma.tenant.findMany.mockResolvedValue([tenant('tenant-a', 'Alpha Studio'), tenant('tenant-b', 'Beta Studio')]);

    const result = await service.searchTenants({
      keyword: 'hair',
      locality: 'Indiranagar',
      latitude: 12.9716,
      longitude: 77.5946,
      radiusKm: 5,
      take: 2,
    });

    expect(result.items.map((item) => item.id)).toEqual(['tenant-b', 'tenant-a']);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        distanceKm: 1.2,
        availabilityState: 'availability_configured',
      }),
    );
    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['tenant-b', 'tenant-a'] } },
      }),
    );
  });

  it('reverse geocodes coordinates into a locality label', async () => {
    const { service } = setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Indiranagar, Bengaluru, Karnataka, India',
            address_components: [
              { long_name: 'Indiranagar', short_name: 'Indiranagar', types: ['sublocality_level_1'] },
              { long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality'] },
              { long_name: 'Karnataka', short_name: 'KA', types: ['administrative_area_level_1'] },
              { long_name: 'India', short_name: 'IN', types: ['country'] },
            ],
          },
        ],
      }),
    } as never);

    await expect(service.reverseGeocode(12.9716, 77.5946)).resolves.toEqual({
      formattedAddress: 'Indiranagar, Bengaluru, Karnataka, India',
      locality: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: undefined,
      countryCode: 'IN',
    });
  });
});
