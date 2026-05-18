import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, TenantRole, TenantStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/types';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnonymizeCustomerDto } from './dto/anonymize-customer.dto';
import { BookingStatusNoteDto } from './dto/booking-status-note.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { ListPlatformBookingsQueryDto } from './dto/list-platform-bookings-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  listCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { tenants: true } } },
    });
  }

  async createCategory(dto: CreateCategoryDto, auth: AuthContext, sourceIp?: string) {
    const category = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
        description: dto.description?.trim(),
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record({
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'category',
      entityId: category.id,
      action: 'category.create',
      summary: `Created category ${category.name}`,
      after: this.asJson(category),
      sourceIp,
    });

    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, auth: AuthContext, sourceIp?: string) {
    const before = await this.findCategoryOrThrow(id);
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.slug?.trim().toLowerCase(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });

    await this.audit.record({
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'category',
      entityId: category.id,
      action: 'category.update',
      summary: `Updated category ${category.name}`,
      before: this.asJson(before),
      after: this.asJson(category),
      sourceIp,
    });

    return category;
  }

  listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        primaryCategory: true,
        _count: {
          select: {
            locations: true,
            services: true,
            experts: true,
            bookings: true,
            memberships: true,
          },
        },
      },
    });
  }

  async createTenant(dto: CreateTenantDto, auth: AuthContext, sourceIp?: string) {
    if (dto.primaryCategoryId) {
      await this.findCategoryOrThrow(dto.primaryCategoryId);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
        bookingPrefix: dto.bookingPrefix.trim().toUpperCase(),
        primaryCategoryId: dto.primaryCategoryId,
        timezone: dto.timezone?.trim(),
        description: dto.description?.trim(),
        publicEmail: dto.publicEmail?.trim().toLowerCase(),
        publicPhone: dto.publicPhone?.trim(),
      },
      include: { primaryCategory: true },
    });

    await this.audit.record({
      tenantId: tenant.id,
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'tenant',
      entityId: tenant.id,
      action: 'tenant.create',
      summary: `Created draft tenant ${tenant.name}`,
      after: this.asJson(tenant),
      sourceIp,
    });

    return tenant;
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        primaryCategory: true,
        locations: { orderBy: { createdAt: 'asc' } },
        services: { orderBy: { createdAt: 'asc' } },
        experts: { orderBy: { createdAt: 'asc' } },
        memberships: { include: { user: true } },
        _count: { select: { bookings: true, auditLogs: true, notificationLogs: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async updateTenant(id: string, dto: UpdateTenantDto, auth: AuthContext, sourceIp?: string) {
    const before = await this.getTenant(id);
    if (dto.primaryCategoryId) {
      await this.findCategoryOrThrow(dto.primaryCategoryId);
    }

    if (before.status !== TenantStatus.draft && dto.slug && dto.slug !== before.slug) {
      throw new BadRequestException('Tenant slug is immutable after activation');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.slug?.trim().toLowerCase(),
        bookingPrefix: dto.bookingPrefix?.trim().toUpperCase(),
        primaryCategoryId: dto.primaryCategoryId,
        timezone: dto.timezone?.trim(),
        description: dto.description?.trim(),
        publicEmail: dto.publicEmail?.trim().toLowerCase(),
        publicPhone: dto.publicPhone?.trim(),
      },
      include: { primaryCategory: true },
    });

    await this.audit.record({
      tenantId: tenant.id,
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'tenant',
      entityId: tenant.id,
      action: 'tenant.update',
      summary: `Updated tenant ${tenant.name}`,
      before: this.asJson(before),
      after: this.asJson(tenant),
      sourceIp,
    });

    return tenant;
  }

  async activateTenant(id: string, auth: AuthContext, sourceIp?: string) {
    const before = await this.getTenant(id);
    const missing = await this.activationGaps(id);

    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Tenant cannot be activated because required setup is missing',
        missing,
      });
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.active, activatedAt: before.activatedAt ?? new Date() },
      include: { primaryCategory: true },
    });

    await this.audit.record({
      tenantId: tenant.id,
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'tenant',
      entityId: tenant.id,
      action: 'tenant.activate',
      summary: `Activated tenant ${tenant.name}`,
      before: this.asJson(before),
      after: this.asJson(tenant),
      sourceIp,
    });

    return tenant;
  }

  setTenantStatus(id: string, status: TenantStatus, auth: AuthContext, sourceIp?: string) {
    return this.transitionTenantStatus(id, status, auth, sourceIp);
  }

  async createFirstTenantAdmin(tenantId: string, dto: CreateTenantAdminDto, auth: AuthContext, sourceIp?: string) {
    await this.getTenant(tenantId);

    const existingAdmins = await this.prisma.tenantMembership.count({
      where: {
        tenantId,
        role: { in: [TenantRole.owner, TenantRole.admin] },
      },
    });

    if (existingAdmins > 0) {
      throw new BadRequestException('Tenant already has an admin membership');
    }

    const email = dto.email.trim().toLowerCase();
    const temporaryPassword = dto.temporaryPassword ?? this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email },
        update: {
          name: dto.name.trim(),
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        create: {
          email,
          name: dto.name.trim(),
          passwordHash,
        },
      });

      const membership = await tx.tenantMembership.create({
        data: {
          tenantId,
          userId: user.id,
          role: TenantRole.owner,
        },
        include: { user: true, tenant: true },
      });

      return { user, membership };
    });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'tenant_membership',
      entityId: result.membership.id,
      action: 'tenant_admin.create_first',
      summary: `Created first tenant admin ${result.user.email}`,
      after: this.asJson({
        membershipId: result.membership.id,
        tenantId,
        userId: result.user.id,
        email: result.user.email,
        role: result.membership.role,
      }),
      sourceIp,
    });

    return {
      tenantId,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      membership: {
        id: result.membership.id,
        role: result.membership.role,
      },
      temporaryPassword,
    };
  }

  async listAuditLogs(query: ListLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId: query.tenantId,
      createdAt: this.dateRange(query),
      OR: query.search
        ? [
            { action: { contains: query.search, mode: 'insensitive' } },
            { summary: { contains: query.search, mode: 'insensitive' } },
            { entityType: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.take ?? 50,
        skip: query.skip ?? 0,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, take: query.take ?? 50, skip: query.skip ?? 0 };
  }

  async listNotificationLogs(query: ListLogsQueryDto) {
    const where: Prisma.NotificationLogWhereInput = {
      tenantId: query.tenantId,
      createdAt: this.dateRange(query),
      OR: query.search
        ? [
            { templateKey: { contains: query.search, mode: 'insensitive' } },
            { provider: { contains: query.search, mode: 'insensitive' } },
            { status: { equals: query.search as never } },
            { recipientEmail: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.take ?? 50,
        skip: query.skip ?? 0,
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return { items, total, take: query.take ?? 50, skip: query.skip ?? 0 };
  }

  notificationQueueStats() {
    return this.notifications.queueStats();
  }

  async listBookings(query: ListPlatformBookingsQueryDto) {
    const where: Prisma.BookingWhereInput = {
      tenantId: query.tenantId,
      status: query.status,
      startsAt: this.bookingDateRange(query),
      OR: query.search
        ? [
            { bookingReference: { contains: query.search, mode: 'insensitive' } },
            { customerNameSnapshot: { contains: query.search, mode: 'insensitive' } },
            { customerPhoneSnapshot: { contains: query.search, mode: 'insensitive' } },
            { customerEmailSnapshot: { contains: query.search, mode: 'insensitive' } },
            { tenant: { name: { contains: query.search, mode: 'insensitive' } } },
            { service: { name: { contains: query.search, mode: 'insensitive' } } },
            { expert: { displayName: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        take: query.take ?? 50,
        skip: query.skip ?? 0,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          service: { select: { id: true, name: true } },
          expert: { select: { id: true, displayName: true } },
          location: { select: { id: true, name: true, locality: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { items, total, take: query.take ?? 50, skip: query.skip ?? 0 };
  }

  async getBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tenant: true,
        service: true,
        expert: true,
        location: true,
        customer: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async cancelBooking(bookingId: string, dto: BookingStatusNoteDto, auth: AuthContext, sourceIp?: string) {
    const before = await this.getBooking(bookingId);
    if (before.status !== BookingStatus.confirmed) {
      throw new BadRequestException('Only confirmed bookings can be cancelled');
    }

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.cancelled, cancelledAt: new Date() },
    });

    await this.audit.record({
      tenantId: booking.tenantId,
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'booking',
      entityId: booking.id,
      action: 'booking.cancelled',
      summary: dto.reason ? `Cancelled booking as platform admin: ${dto.reason}` : 'Cancelled booking as platform admin',
      before: this.asJson(before),
      after: this.asJson(booking),
      sourceIp,
    });

    await this.notifications.enqueueBookingCancelled({
      tenantId: booking.tenantId,
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

  async anonymizeCustomer(dto: AnonymizeCustomerDto, auth: AuthContext, sourceIp?: string) {
    if (!dto.customerId && !dto.phone) {
      throw new BadRequestException('Provide either customerId or phone');
    }

    const customerWhere: Prisma.CustomerWhereInput = {
      id: dto.customerId,
      phone: dto.phone,
      tenantId: dto.tenantId,
    };

    const customers = await this.prisma.customer.findMany({ where: customerWhere });
    if (customers.length === 0) {
      throw new NotFoundException('No matching customer records found');
    }

    const customerIds = customers.map((customer) => customer.id);
    const names = [...new Set(customers.map((customer) => customer.name).filter(Boolean))];
    const phones = [...new Set(customers.map((customer) => customer.phone).filter((phone): phone is string => Boolean(phone)))];
    const emails = [...new Set(customers.map((customer) => customer.email).filter((email): email is string => Boolean(email)))];
    const tenantIds = [...new Set(customers.map((customer) => customer.tenantId))];
    const affectedTenantWhere = dto.tenantId ? dto.tenantId : { in: tenantIds };

    const result = await this.prisma.$transaction(async (tx) => {
      const customerUpdate = await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: {
          name: 'Anonymized Customer',
          phone: null,
          email: null,
        },
      });

      const bookingUpdate = await tx.booking.updateMany({
        where: {
          tenantId: affectedTenantWhere,
          OR: [{ customerId: { in: customerIds } }, { customerPhoneSnapshot: { in: phones } }],
        },
        data: {
          customerNameSnapshot: 'Anonymized Customer',
          customerPhoneSnapshot: null,
          customerEmailSnapshot: null,
          customerNote: null,
        },
      });

      const notificationLogs = await tx.notificationLog.findMany({
        where: {
          tenantId: affectedTenantWhere,
          OR: [
            { recipientPhone: { in: phones } },
            { recipientEmail: { in: emails } },
            ...phones.map((phone) => ({ payload: { path: ['customerPhone'], equals: phone } })),
            ...emails.map((email) => ({ payload: { path: ['customerEmail'], equals: email } })),
            ...names.map((name) => ({ payload: { path: ['customerName'], equals: name } })),
          ],
        },
      });

      for (const log of notificationLogs) {
        await tx.notificationLog.update({
          where: { id: log.id },
          data: {
            recipientEmail: null,
            recipientPhone: null,
            payload: this.redactJson(log.payload),
          },
        });
      }

      const attemptUpdate = await tx.bookingAttemptLog.updateMany({
        where: {
          tenantId: affectedTenantWhere,
          OR: [{ customerPhone: { in: phones } }, { customerEmail: { in: emails } }, { customerName: { in: names } }],
        },
        data: {
          customerName: 'Anonymized Customer',
          customerPhone: null,
          customerEmail: null,
          customerNote: null,
        },
      });

      const auditLogs = await tx.auditLog.findMany({
        where: {
          tenantId: affectedTenantWhere,
          OR: [{ before: { not: Prisma.JsonNull } }, { after: { not: Prisma.JsonNull } }],
        },
      });

      for (const log of auditLogs) {
        await tx.auditLog.update({
          where: { id: log.id },
          data: {
            before: log.before ? this.redactJson(log.before) : undefined,
            after: log.after ? this.redactJson(log.after) : undefined,
          },
        });
      }

      return {
        customers: customerUpdate.count,
        bookings: bookingUpdate.count,
        notificationLogs: notificationLogs.length,
        bookingAttemptLogs: attemptUpdate.count,
        auditLogs: auditLogs.length,
      };
    });

    await this.audit.record({
      tenantId: dto.tenantId ?? (tenantIds.length === 1 ? tenantIds[0] : null),
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'customer',
      entityId: dto.customerId ?? dto.phone ?? 'multiple',
      action: 'customer.anonymize',
      summary: `Anonymized ${result.customers} customer record(s)`,
      after: this.asJson(result),
      sourceIp,
    });

    return result;
  }

  private async transitionTenantStatus(
    id: string,
    status: TenantStatus,
    auth: AuthContext,
    sourceIp?: string,
  ) {
    const before = await this.getTenant(id);
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status },
      include: { primaryCategory: true },
    });

    await this.audit.record({
      tenantId: tenant.id,
      actorUserId: auth.user.id,
      actorRole: 'platform_admin',
      entityType: 'tenant',
      entityId: tenant.id,
      action: `tenant.${status}`,
      summary: `Set tenant ${tenant.name} to ${status}`,
      before: this.asJson(before),
      after: this.asJson(tenant),
      sourceIp,
    });

    return tenant;
  }

  private async activationGaps(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { primaryCategory: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [locations, activeServices, activeExperts, activeAssignments, activeAvailabilityRules] = await Promise.all([
      this.prisma.location.count({
        where: { tenantId, isActive: true, archivedAt: null, addressLine: { not: '' }, locality: { not: '' } },
      }),
      this.prisma.service.count({ where: { tenantId, isActive: true, archivedAt: null } }),
      this.prisma.expert.count({ where: { tenantId, isActive: true, archivedAt: null } }),
      this.prisma.expertService.count({
        where: {
          tenantId,
          isActive: true,
          expert: { isActive: true, archivedAt: null },
          service: { isActive: true, archivedAt: null },
        },
      }),
      this.prisma.availabilityRule.count({
        where: { tenantId, isActive: true, expert: { isActive: true, archivedAt: null } },
      }),
    ]);

    const missing: string[] = [];
    if (!tenant.name.trim()) missing.push('tenant name');
    if (!tenant.primaryCategoryId) missing.push('primary category');
    if (!tenant.timezone) missing.push('timezone');
    if (locations < 1) missing.push('active location with address/locality/coordinates');
    if (activeServices < 1) missing.push('one active service');
    if (activeExperts < 1) missing.push('one active expert');
    if (activeAssignments < 1) missing.push('one active expert-service assignment');
    if (activeAvailabilityRules < 1) missing.push('one availability rule for an active expert');
    return missing;
  }

  private findCategoryOrThrow(id: string) {
    return this.prisma.category.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Category not found');
    });
  }

  private dateRange(query: ListLogsQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) {
      return undefined;
    }

    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(query.to) : undefined,
    };
  }

  private bookingDateRange(query: ListPlatformBookingsQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) {
      return undefined;
    }

    const to = query.to ? new Date(query.to) : undefined;
    if (to) {
      to.setDate(to.getDate() + 1);
      to.setMilliseconds(to.getMilliseconds() - 1);
    }

    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: to,
    };
  }

  private generateTemporaryPassword() {
    return `Tmp-${randomBytes(12).toString('base64url')}`;
  }

  private redactJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue {
    const redact = (input: unknown): unknown => {
      if (Array.isArray(input)) {
        return input.map((item) => redact(item));
      }

      if (!input || typeof input !== 'object') {
        return input;
      }

      const redacted: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(input)) {
        const normalizedKey = key.toLowerCase();
        if (normalizedKey.includes('email') || normalizedKey.includes('phone')) {
          redacted[key] = null;
        } else if (normalizedKey.includes('name')) {
          redacted[key] = 'Anonymized Customer';
        } else if (normalizedKey.includes('note')) {
          redacted[key] = null;
        } else {
          redacted[key] = redact(nestedValue);
        }
      }
      return redacted;
    };

    return redact(value) as Prisma.InputJsonValue;
  }

  private asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
