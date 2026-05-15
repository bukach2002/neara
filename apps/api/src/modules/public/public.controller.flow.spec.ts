import { PublicController } from './public.controller';

describe('PublicController customer booking flow', () => {
  function setup() {
    const bookingService = {
      createPublicBooking: jest.fn(),
      lookupBooking: jest.fn(),
    };
    const publicService = {
      searchTenants: jest.fn(),
      getTenantBySlug: jest.fn(),
      listTenantServices: jest.fn(),
      listTenantExperts: jest.fn(),
      listCategories: jest.fn(),
    };
    const schedulingService = {
      getAvailableSlots: jest.fn(),
    };
    const controller = new PublicController(bookingService as never, publicService as never, schedulingService as never);
    return { bookingService, controller, publicService, schedulingService };
  }

  it('keeps the anonymous discovery-to-booking contract wired through controllers', async () => {
    const { bookingService, controller, publicService, schedulingService } = setup();
    publicService.searchTenants.mockResolvedValue({ items: [{ slug: 'near-beauty-studio' }], meta: { distanceUnit: 'km' } });
    publicService.getTenantBySlug.mockResolvedValue({ slug: 'near-beauty-studio', name: 'Near Beauty Studio' });
    schedulingService.getAvailableSlots.mockResolvedValue({
      items: [{ startsAt: '2026-05-15T04:30:00.000Z', expert: { id: 'expert-1' } }],
    });
    bookingService.createPublicBooking.mockResolvedValue({
      bookingReference: 'NEAR-7A2K',
      status: 'confirmed',
    });
    bookingService.lookupBooking.mockResolvedValue({
      bookingReference: 'NEAR-7A2K',
      status: 'confirmed',
    });

    await expect(controller.searchTenants({ keyword: 'hair', locality: 'Indiranagar' })).resolves.toEqual({
      items: [{ slug: 'near-beauty-studio' }],
      meta: { distanceUnit: 'km' },
    });
    await expect(controller.tenant('near-beauty-studio')).resolves.toEqual({
      slug: 'near-beauty-studio',
      name: 'Near Beauty Studio',
    });
    await expect(
      controller.availableSlots('near-beauty-studio', {
        serviceId: 'service-1',
        expertId: 'expert-1',
        date: '2026-05-15',
      }),
    ).resolves.toEqual({
      items: [{ startsAt: '2026-05-15T04:30:00.000Z', expert: { id: 'expert-1' } }],
    });
    await expect(
      controller.createBooking(
        'near-beauty-studio',
        {
          serviceId: 'service-1',
          expertId: 'expert-1',
          startsAt: '2026-05-15T04:30:00.000Z',
          customerName: 'Customer One',
          customerPhone: '+919876543210',
          consentAccepted: true,
        },
        { ip: '127.0.0.1' } as never,
      ),
    ).resolves.toEqual({ bookingReference: 'NEAR-7A2K', status: 'confirmed' });
    await expect(controller.lookupBooking({ reference: 'NEAR-7A2K', phone: '+919876543210' })).resolves.toEqual({
      bookingReference: 'NEAR-7A2K',
      status: 'confirmed',
    });

    expect(schedulingService.getAvailableSlots).toHaveBeenCalledWith({
      tenantSlug: 'near-beauty-studio',
      serviceId: 'service-1',
      expertId: 'expert-1',
      date: '2026-05-15',
    });
    expect(bookingService.createPublicBooking).toHaveBeenCalledWith(
      'near-beauty-studio',
      expect.objectContaining({ customerPhone: '+919876543210', consentAccepted: true }),
      '127.0.0.1',
    );
  });
});
