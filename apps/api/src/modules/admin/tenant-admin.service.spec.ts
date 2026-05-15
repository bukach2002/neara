import { BadRequestException } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';

function setup(apiKey = 'maps-key') {
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Tenant One' }),
    },
  };
  const config = { get: jest.fn().mockReturnValue(apiKey) };
  const service = new TenantAdminService({} as never, {} as never, prisma as never, {} as never, config as never);
  return { config, prisma, service };
}

describe('TenantAdminService geocoding', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a Google geocoding result into location fields', async () => {
    const { service } = setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: '12 MG Road, Bengaluru, Karnataka 560001, India',
            geometry: { location: { lat: 12.9716, lng: 77.5946 } },
            address_components: [
              { long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality'] },
              { long_name: 'Karnataka', short_name: 'KA', types: ['administrative_area_level_1'] },
              { long_name: '560001', short_name: '560001', types: ['postal_code'] },
              { long_name: 'India', short_name: 'IN', types: ['country'] },
            ],
          },
        ],
      }),
    } as never);

    await expect(service.geocodeLocation('tenant-1', '12 MG Road Bengaluru')).resolves.toEqual({
      formattedAddress: '12 MG Road, Bengaluru, Karnataka 560001, India',
      latitude: 12.9716,
      longitude: 77.5946,
      locality: 'Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      countryCode: 'IN',
    });
  });

  it('rejects geocoding when Google Maps is not configured', async () => {
    const { service } = setup('');

    await expect(service.geocodeLocation('tenant-1', '12 MG Road Bengaluru')).rejects.toBeInstanceOf(BadRequestException);
  });
});
