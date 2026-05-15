import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvailabilityExceptionType, BookingStatus, Prisma, UploadedAssetOwnerType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/types';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { BookingStatusNoteDto } from './dto/booking-status-note.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { CreateExpertDto } from './dto/create-expert.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { SetExpertServicesDto } from './dto/set-expert-services.dto';
import { UpdateExpertDto } from './dto/update-expert.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { UpsertLocationDto } from './dto/upsert-location.dto';

@Injectable()
export class TenantAdminService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
    private readonly uploads: UploadService,
    private readonly config: ConfigService,
  ) {}

  async getDashboard(tenantId: string) {
    await this.findTenantOrThrow(tenantId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [bookingsToday, upcomingBookings, confirmedBookings, cancelledBookings] = await Promise.all([
      this.prisma.booking.count({ where: { tenantId, startsAt: { gte: startOfToday, lt: endOfToday } } }),
      this.prisma.booking.count({ where: { tenantId, status: 'confirmed', startsAt: { gte: new Date() } } }),
      this.prisma.booking.count({ where: { tenantId, status: 'confirmed' } }),
      this.prisma.booking.count({ where: { tenantId, status: 'cancelled' } }),
    ]);

    return { bookingsToday, upcomingBookings, confirmedBookings, cancelledBookings };
  }

  getProfile(tenantId: string) {
    return this.findTenantOrThrow(tenantId);
  }

  async updateProfile(tenantId: string, dto: UpdateTenantProfileDto, auth: AuthContext, sourceIp?: string) {
    const before = await this.findTenantOrThrow(tenantId);
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        description: dto.description?.trim(),
        publicEmail: dto.publicEmail?.trim().toLowerCase(),
        publicPhone: dto.publicPhone?.trim(),
      },
    });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'tenant',
      entityId: tenantId,
      action: 'tenant.profile.update',
      summary: 'Updated tenant profile',
      before: this.asJson(before),
      after: this.asJson(tenant),
      sourceIp,
    });

    return tenant;
  }

  listLocations(tenantId: string) {
    return this.prisma.location.findMany({ where: { tenantId, archivedAt: null }, orderBy: { createdAt: 'asc' } });
  }

  async upsertPrimaryLocation(tenantId: string, dto: UpsertLocationDto, auth: AuthContext, sourceIp?: string) {
    await this.findTenantOrThrow(tenantId);
    const existing = await this.prisma.location.findFirst({ where: { tenantId, isPrimary: true, archivedAt: null } });
    const data = {
      name: dto.name.trim(),
      addressLine: dto.addressLine.trim(),
      locality: dto.locality.trim(),
      city: dto.city.trim(),
      state: dto.state?.trim(),
      postalCode: dto.postalCode?.trim(),
      countryCode: dto.countryCode?.trim().toUpperCase() ?? 'IN',
      latitude: new Prisma.Decimal(dto.latitude),
      longitude: new Prisma.Decimal(dto.longitude),
      isPrimary: true,
      isActive: dto.isActive ?? true,
    };

    const location = existing
      ? await this.prisma.location.update({ where: { id: existing.id }, data })
      : await this.prisma.location.create({ data: { tenantId, ...data } });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'location',
      entityId: location.id,
      action: existing ? 'location.update' : 'location.create',
      summary: `${existing ? 'Updated' : 'Created'} primary location`,
      before: existing ? this.asJson(existing) : null,
      after: this.asJson(location),
      sourceIp,
    });

    return location;
  }

  async geocodeLocation(tenantId: string, address: string) {
    await this.findTenantOrThrow(tenantId);
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY', '');
    if (!apiKey) {
      throw new BadRequestException('Google Maps API key is not configured');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('region', 'in');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException('Geocoding request failed');
    }

    const payload = (await response.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
      }>;
    };

    const result = payload.results?.[0];
    if (payload.status !== 'OK' || !result) {
      throw new BadRequestException(payload.error_message || 'No geocoding result found');
    }

    const component = (type: string) => result.address_components.find((item) => item.types.includes(type));
    return {
      formattedAddress: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      locality: component('sublocality')?.long_name ?? component('locality')?.long_name,
      city: component('locality')?.long_name ?? component('administrative_area_level_3')?.long_name,
      state: component('administrative_area_level_1')?.long_name,
      postalCode: component('postal_code')?.long_name,
      countryCode: component('country')?.short_name,
    };
  }

  async uploadTenantLogo(tenantId: string, file: Express.Multer.File, auth: AuthContext, sourceIp?: string) {
    const before = await this.findTenantOrThrow(tenantId);
    const asset = await this.uploads.uploadImage({
      tenantId,
      ownerType: UploadedAssetOwnerType.tenant,
      ownerId: tenantId,
      folder: 'tenant-logos',
      file,
    });

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: asset.url },
    });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'tenant',
      entityId: tenantId,
      action: 'tenant.logo.upload',
      summary: 'Uploaded tenant logo',
      before: this.asJson({ logoUrl: before.logoUrl }),
      after: this.asJson({ logoUrl: tenant.logoUrl, assetId: asset.id }),
      sourceIp,
    });

    return { asset, tenant };
  }

  listServices(tenantId: string) {
    return this.prisma.service.findMany({ where: { tenantId, archivedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  async createService(tenantId: string, dto: CreateServiceDto, auth: AuthContext, sourceIp?: string) {
    await this.findTenantOrThrow(tenantId);
    const service = await this.prisma.service.create({ data: this.createServiceData(tenantId, dto) });
    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'service',
      entityId: service.id,
      action: 'service.create',
      summary: `Created service ${service.name}`,
      after: this.asJson(service),
      sourceIp,
    });
    return service;
  }

  async updateService(tenantId: string, serviceId: string, dto: UpdateServiceDto, auth: AuthContext, sourceIp?: string) {
    const before = await this.findServiceOrThrow(tenantId, serviceId);
    const service = await this.prisma.service.update({ where: { id: serviceId }, data: this.updateServiceData(dto) });
    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'service',
      entityId: service.id,
      action: 'service.update',
      summary: `Updated service ${service.name}`,
      before: this.asJson(before),
      after: this.asJson(service),
      sourceIp,
    });
    return service;
  }

  listExperts(tenantId: string) {
    return this.prisma.expert.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { expertServices: { include: { service: true } } },
    });
  }

  async createExpert(tenantId: string, dto: CreateExpertDto, auth: AuthContext, sourceIp?: string) {
    await this.findTenantOrThrow(tenantId);
    const expert = await this.prisma.expert.create({ data: this.createExpertData(tenantId, dto) });
    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'expert',
      entityId: expert.id,
      action: 'expert.create',
      summary: `Created expert ${expert.displayName}`,
      after: this.asJson(expert),
      sourceIp,
    });
    return expert;
  }

  async updateExpert(tenantId: string, expertId: string, dto: UpdateExpertDto, auth: AuthContext, sourceIp?: string) {
    const before = await this.findExpertOrThrow(tenantId, expertId);
    const expert = await this.prisma.expert.update({ where: { id: expertId }, data: this.updateExpertData(dto) });
    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'expert',
      entityId: expert.id,
      action: 'expert.update',
      summary: `Updated expert ${expert.displayName}`,
      before: this.asJson(before),
      after: this.asJson(expert),
      sourceIp,
    });
    return expert;
  }

  async uploadExpertPhoto(tenantId: string, expertId: string, file: Express.Multer.File, auth: AuthContext, sourceIp?: string) {
    const before = await this.findExpertOrThrow(tenantId, expertId);
    const asset = await this.uploads.uploadImage({
      tenantId,
      ownerType: UploadedAssetOwnerType.expert,
      ownerId: expertId,
      folder: 'expert-photos',
      file,
    });

    const expert = await this.prisma.expert.update({
      where: { id: expertId },
      data: { photoUrl: asset.url },
    });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'expert',
      entityId: expertId,
      action: 'expert.photo.upload',
      summary: `Uploaded photo for expert ${expert.displayName}`,
      before: this.asJson({ photoUrl: before.photoUrl }),
      after: this.asJson({ photoUrl: expert.photoUrl, assetId: asset.id }),
      sourceIp,
    });

    return { asset, expert };
  }

  async setExpertServices(tenantId: string, expertId: string, dto: SetExpertServicesDto, auth: AuthContext, sourceIp?: string) {
    await this.findExpertOrThrow(tenantId, expertId);
    const services = await this.prisma.service.findMany({ where: { tenantId, id: { in: dto.serviceIds }, archivedAt: null } });
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('All services must belong to the tenant');
    }

    await this.prisma.$transaction([
      this.prisma.expertService.deleteMany({ where: { tenantId, expertId } }),
      ...dto.serviceIds.map((serviceId) =>
        this.prisma.expertService.create({ data: { tenantId, expertId, serviceId, isActive: true } }),
      ),
    ]);

    const assignments = await this.prisma.expertService.findMany({ where: { tenantId, expertId }, include: { service: true } });
    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'expert',
      entityId: expertId,
      action: 'expert.services.set',
      summary: 'Updated expert service assignments',
      after: this.asJson(assignments),
      sourceIp,
    });
    return assignments;
  }

  listAvailabilityRules(tenantId: string, expertId: string) {
    return this.prisma.availabilityRule.findMany({
      where: { tenantId, expertId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startLocalTime: 'asc' }],
    });
  }

  async createAvailabilityRule(
    tenantId: string,
    expertId: string,
    dto: CreateAvailabilityRuleDto,
    auth: AuthContext,
    sourceIp?: string,
  ) {
    await this.findExpertOrThrow(tenantId, expertId);
    this.assertValidWindow(dto.startLocalTime, dto.endLocalTime);
    await this.assertNoAvailabilityOverlap(tenantId, expertId, dto);

    const rule = await this.prisma.availabilityRule.create({ data: { tenantId, expertId, ...dto } });
    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'availability_rule',
      entityId: rule.id,
      action: 'availability_rule.create',
      summary: `Created availability rule for day ${rule.dayOfWeek}`,
      after: this.asJson(rule),
      sourceIp,
    });
    return rule;
  }

  async deleteAvailabilityRule(tenantId: string, expertId: string, ruleId: string, auth: AuthContext, sourceIp?: string) {
    const before = await this.prisma.availabilityRule.findFirst({ where: { id: ruleId, tenantId, expertId } });
    if (!before) throw new NotFoundException('Availability rule not found');
    const rule = await this.prisma.availabilityRule.update({ where: { id: ruleId }, data: { isActive: false } });
    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'availability_rule',
      entityId: rule.id,
      action: 'availability_rule.delete',
      summary: 'Archived availability rule',
      before: this.asJson(before),
      after: this.asJson(rule),
      sourceIp,
    });
    return rule;
  }

  listAvailabilityExceptions(tenantId: string, expertId: string) {
    return this.prisma.availabilityException.findMany({
      where: { tenantId, expertId },
      orderBy: [{ startsOn: 'asc' }, { startLocalTime: 'asc' }],
    });
  }

  async createAvailabilityException(
    tenantId: string,
    expertId: string,
    dto: CreateAvailabilityExceptionDto,
    auth: AuthContext,
    sourceIp?: string,
  ) {
    await this.findExpertOrThrow(tenantId, expertId);
    const startsOn = this.dateOnly(dto.startsOn);
    const endsOn = this.dateOnly(dto.endsOn);
    if (endsOn < startsOn) {
      throw new BadRequestException('Exception end date must be on or after start date');
    }

    if (dto.type === AvailabilityExceptionType.override) {
      if (!dto.startLocalTime || !dto.endLocalTime) {
        throw new BadRequestException('Override exceptions require start and end local times');
      }
      this.assertValidWindow(dto.startLocalTime, dto.endLocalTime);
    }

    if (dto.type === AvailabilityExceptionType.block && dto.startLocalTime && dto.endLocalTime) {
      this.assertValidWindow(dto.startLocalTime, dto.endLocalTime);
    }

    const exception = await this.prisma.availabilityException.create({
      data: {
        tenantId,
        expertId,
        type: dto.type,
        startsOn,
        endsOn,
        startLocalTime: dto.startLocalTime,
        endLocalTime: dto.endLocalTime,
        reason: dto.reason?.trim(),
      },
    });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'availability_exception',
      entityId: exception.id,
      action: 'availability_exception.create',
      summary: `Created ${exception.type} availability exception`,
      after: this.asJson(exception),
      sourceIp,
    });

    return exception;
  }

  async deleteAvailabilityException(
    tenantId: string,
    expertId: string,
    exceptionId: string,
    auth: AuthContext,
    sourceIp?: string,
  ) {
    const before = await this.prisma.availabilityException.findFirst({ where: { id: exceptionId, tenantId, expertId } });
    if (!before) throw new NotFoundException('Availability exception not found');
    const deleted = await this.prisma.availabilityException.delete({ where: { id: exceptionId } });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'availability_exception',
      entityId: deleted.id,
      action: 'availability_exception.delete',
      summary: `Deleted ${deleted.type} availability exception`,
      before: this.asJson(before),
      sourceIp,
    });

    return { ok: true, id: deleted.id };
  }

  async listBookings(tenantId: string, query: ListBookingsQueryDto) {
    await this.findTenantOrThrow(tenantId);
    const where = this.bookingWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        take: query.take ?? 50,
        skip: query.skip ?? 0,
        include: {
          service: { select: { id: true, name: true } },
          expert: { select: { id: true, displayName: true } },
          location: { select: { id: true, name: true, locality: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, take: query.take ?? 50, skip: query.skip ?? 0 };
  }

  async getBooking(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        service: true,
        expert: true,
        location: true,
        customer: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async cancelBooking(tenantId: string, bookingId: string, dto: BookingStatusNoteDto, auth: AuthContext, sourceIp?: string) {
    const booking = await this.transitionBooking(tenantId, bookingId, BookingStatus.cancelled, dto, auth, sourceIp);
    await this.notifications.enqueueBookingCancelled({
      tenantId,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      customerEmail: booking.customerEmailSnapshot,
      customerName: booking.customerNameSnapshot,
      tenantName: booking.tenantNameSnapshot,
      serviceName: booking.serviceNameSnapshot,
      expertName: booking.expertDisplayNameSnapshot,
      displayTime: booking.displayTimeSnapshot,
    });
    return booking;
  }

  completeBooking(tenantId: string, bookingId: string, dto: BookingStatusNoteDto, auth: AuthContext, sourceIp?: string) {
    return this.transitionBooking(tenantId, bookingId, BookingStatus.completed, dto, auth, sourceIp);
  }

  markBookingNoShow(tenantId: string, bookingId: string, dto: BookingStatusNoteDto, auth: AuthContext, sourceIp?: string) {
    return this.transitionBooking(tenantId, bookingId, BookingStatus.no_show, dto, auth, sourceIp);
  }

  private async transitionBooking(
    tenantId: string,
    bookingId: string,
    status: BookingStatus,
    dto: BookingStatusNoteDto,
    auth: AuthContext,
    sourceIp?: string,
  ) {
    const before = await this.getBooking(tenantId, bookingId);
    if (before.status !== BookingStatus.confirmed) {
      throw new BadRequestException('Only confirmed bookings can change status in MVP');
    }

    const timestampField =
      status === BookingStatus.cancelled ? 'cancelledAt' : status === BookingStatus.completed ? 'completedAt' : 'noShowAt';

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status, [timestampField]: new Date() },
    });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'booking',
      entityId: booking.id,
      action: `booking.${status}`,
      summary: dto.reason ? `Marked booking ${status}: ${dto.reason}` : `Marked booking ${status}`,
      before: this.asJson(before),
      after: this.asJson(booking),
      sourceIp,
    });

    return booking;
  }

  private createServiceData(tenantId: string, dto: CreateServiceDto): Prisma.ServiceUncheckedCreateInput {
    return {
      tenantId,
      name: dto.name.trim(),
      slug: dto.slug.trim().toLowerCase(),
      description: dto.description?.trim(),
      durationMinutes: dto.durationMinutes,
      displayPriceAmount: dto.displayPriceAmount === undefined ? undefined : new Prisma.Decimal(dto.displayPriceAmount),
      displayPriceCurrency: dto.displayPriceCurrency?.trim().toUpperCase() ?? 'INR',
      isActive: dto.isActive ?? true,
      isPublic: dto.isPublic ?? true,
    };
  }

  private updateServiceData(dto: UpdateServiceDto): Prisma.ServiceUncheckedUpdateInput {
    return {
      name: dto.name?.trim(),
      slug: dto.slug?.trim().toLowerCase(),
      description: dto.description?.trim(),
      durationMinutes: dto.durationMinutes,
      displayPriceAmount: dto.displayPriceAmount === undefined ? undefined : new Prisma.Decimal(dto.displayPriceAmount),
      displayPriceCurrency: dto.displayPriceCurrency?.trim().toUpperCase() ?? undefined,
      isActive: dto.isActive,
      isPublic: dto.isPublic,
    };
  }

  private createExpertData(tenantId: string, dto: CreateExpertDto): Prisma.ExpertUncheckedCreateInput {
    return {
      tenantId,
      displayName: dto.displayName.trim(),
      slug: dto.slug.trim().toLowerCase(),
      shortBio: dto.shortBio?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.trim().toLowerCase(),
      isActive: dto.isActive ?? true,
    };
  }

  private updateExpertData(dto: UpdateExpertDto): Prisma.ExpertUncheckedUpdateInput {
    return {
      displayName: dto.displayName?.trim(),
      slug: dto.slug?.trim().toLowerCase(),
      shortBio: dto.shortBio?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.trim().toLowerCase(),
      isActive: dto.isActive,
    };
  }

  private async findTenantOrThrow(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, include: { primaryCategory: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async findServiceOrThrow(tenantId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, tenantId, archivedAt: null } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  private async findExpertOrThrow(tenantId: string, expertId: string) {
    const expert = await this.prisma.expert.findFirst({ where: { id: expertId, tenantId, archivedAt: null } });
    if (!expert) throw new NotFoundException('Expert not found');
    return expert;
  }

  private assertValidWindow(startLocalTime: string, endLocalTime: string) {
    if (this.minutes(endLocalTime) <= this.minutes(startLocalTime)) {
      throw new BadRequestException('Availability end time must be after start time');
    }
  }

  private async assertNoAvailabilityOverlap(tenantId: string, expertId: string, dto: CreateAvailabilityRuleDto) {
    const rules = await this.prisma.availabilityRule.findMany({
      where: { tenantId, expertId, dayOfWeek: dto.dayOfWeek, isActive: true },
    });
    const start = this.minutes(dto.startLocalTime);
    const end = this.minutes(dto.endLocalTime);
    const overlap = rules.some((rule) => start < this.minutes(rule.endLocalTime) && end > this.minutes(rule.startLocalTime));
    if (overlap) {
      throw new BadRequestException('Availability windows for the same expert/day cannot overlap');
    }
  }

  private minutes(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private dateOnly(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private bookingWhere(tenantId: string, query: ListBookingsQueryDto): Prisma.BookingWhereInput {
    return {
      tenantId,
      status: query.status,
      serviceId: query.serviceId,
      expertId: query.expertId,
      startsAt: query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined,
      OR: query.search
        ? [
            { bookingReference: { contains: query.search, mode: 'insensitive' } },
            { customerNameSnapshot: { contains: query.search, mode: 'insensitive' } },
            { customerPhoneSnapshot: { contains: query.search, mode: 'insensitive' } },
            { customerEmailSnapshot: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
