import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantRole, TenantStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { AuthContext } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSignupDto } from './dto/tenant-signup.dto';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'business',
  'help',
  'login',
  'neara',
  'public',
  'register',
  'signup',
  'static',
  'support',
  'www',
]);

type SetupStepKey = 'profile' | 'location' | 'services' | 'team' | 'availability';

type SetupSteps = Record<SetupStepKey, boolean>;

const STEP_LABELS: Record<SetupStepKey, string> = {
  profile: 'business profile (category and timezone)',
  location: 'an active location with address and locality',
  services: 'at least one active service',
  team: 'an active expert assigned to a service',
  availability: 'at least one availability rule for an active expert',
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async checkSlug(rawSlug: string) {
    const slug = this.normalizeSlug(rawSlug);

    if (!this.isValidSlug(slug)) {
      return { slug, available: false, reason: 'invalid' as const };
    }

    if (RESERVED_SLUGS.has(slug)) {
      return { slug, available: false, reason: 'reserved' as const };
    }

    const existing = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      return { slug, available: false, reason: 'taken' as const, suggestion: await this.suggestSlug(slug) };
    }

    return { slug, available: true, reason: null };
  }

  async signUp(dto: TenantSignupDto, response: Response, sourceIp?: string) {
    const slug = this.normalizeSlug(dto.slug);
    if (!this.isValidSlug(slug)) {
      throw new BadRequestException({
        message: 'Choose a page address using lowercase letters, numbers and single hyphens',
        field: 'slug',
      });
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new ConflictException({ message: 'That page address is reserved. Pick another one.', field: 'slug' });
    }

    const email = dto.email.trim().toLowerCase();
    const [existingUser, existingTenant] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } }),
    ]);

    if (existingUser) {
      throw new ConflictException({
        message: 'An account already exists for this email address. Sign in instead.',
        field: 'email',
      });
    }
    if (existingTenant) {
      throw new ConflictException({ message: 'That page address is already reserved. Pick another one.', field: 'slug' });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const bookingPrefix = await this.nextBookingPrefix(dto.businessName);

    let created: {
      user: { id: string; name: string; email: string | null };
      tenant: { id: string; name: string; slug: string; bookingPrefix: string; status: TenantStatus };
    };

    try {
      created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: dto.ownerName.trim(),
            email,
            passwordHash,
          },
        });

        const tenant = await tx.tenant.create({
          data: {
            name: dto.businessName.trim(),
            slug,
            bookingPrefix,
            timezone: dto.timezone?.trim() || 'Asia/Kolkata',
            publicEmail: email,
            status: TenantStatus.draft,
          },
        });

        await tx.tenantMembership.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: TenantRole.owner,
          },
        });

        return { user, tenant };
      });
    } catch (error) {
      throw this.mapSignupError(error, slug);
    }

    await this.auth.establishAdminSession(created.user.id, response);

    await this.audit.record({
      tenantId: created.tenant.id,
      actorUserId: created.user.id,
      actorRole: 'tenant_admin',
      entityType: 'tenant',
      entityId: created.tenant.id,
      action: 'tenant.self_signup',
      summary: `Tenant self signup for ${created.tenant.name}`,
      after: this.asJson(created.tenant),
      sourceIp,
    });

    return {
      tenant: {
        id: created.tenant.id,
        name: created.tenant.name,
        slug: created.tenant.slug,
        bookingPrefix: created.tenant.bookingPrefix,
        status: created.tenant.status,
      },
      user: {
        id: created.user.id,
        name: created.user.name,
        email: created.user.email,
      },
      nextStep: 'profile' as const,
    };
  }

  async status(tenantId: string, auth: AuthContext) {
    if (!auth.user.memberships.some((membership) => membership.tenantId === tenantId)) {
      throw new ForbiddenException('Tenant access is required');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { primaryCategory: { select: { id: true, name: true, slug: true } } },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const steps = await this.setupSteps(tenantId);
    const missing = (Object.keys(steps) as SetupStepKey[]).filter((key) => !steps[key]).map((key) => STEP_LABELS[key]);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        timezone: tenant.timezone,
        description: tenant.description,
        publicEmail: tenant.publicEmail,
        publicPhone: tenant.publicPhone,
        primaryCategory: tenant.primaryCategory,
      },
      steps,
      missing,
      ready: missing.length === 0,
      isActive: tenant.status === TenantStatus.active,
    };
  }

  async complete(tenantId: string, auth: AuthContext, sourceIp?: string) {
    if (!auth.user.memberships.some((membership) => membership.tenantId === tenantId)) {
      throw new ForbiddenException('Tenant access is required');
    }
    const before = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!before) {
      throw new NotFoundException('Tenant not found');
    }
    if (before.status === TenantStatus.suspended) {
      throw new BadRequestException('This business is suspended. Contact platform support.');
    }

    if (before.status === TenantStatus.active) {
      return {
        tenant: { id: before.id, name: before.name, slug: before.slug, status: before.status },
        workspaceUrl: `/admin/tenant/${before.id}`,
      };
    }

    const steps = await this.setupSteps(tenantId);
    const missing = (Object.keys(steps) as SetupStepKey[]).filter((key) => !steps[key]).map((key) => STEP_LABELS[key]);
    if (missing.length > 0) {
      throw new BadRequestException({ message: 'Finish the remaining setup before going live', missing });
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.active, activatedAt: before.activatedAt ?? new Date() },
    });

    await this.audit.record({
      tenantId,
      actorUserId: auth.user.id,
      actorRole: 'tenant_admin',
      entityType: 'tenant',
      entityId: tenantId,
      action: 'tenant.onboarding.completed',
      summary: `Tenant ${tenant.name} completed self onboarding and went live`,
      before: this.asJson(before),
      after: this.asJson(tenant),
      sourceIp,
    });

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status },
      workspaceUrl: `/admin/tenant/${tenant.id}`,
    };
  }

  private async setupSteps(tenantId: string): Promise<SetupSteps> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { primaryCategoryId: true, timezone: true },
    });

    const [locations, services, experts, assignments, rules] = await Promise.all([
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

    return {
      profile: Boolean(tenant?.primaryCategoryId && tenant.timezone),
      location: locations > 0,
      services: services > 0,
      team: experts > 0 && assignments > 0,
      availability: rules > 0,
    };
  }

  private mapSignupError(error: unknown, slug: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]).join(',') : String(error.meta?.target ?? '');
      if (target.includes('slug')) {
        return new ConflictException({ message: 'That page address is already reserved. Pick another one.', field: 'slug' });
      }
      if (target.includes('email')) {
        return new ConflictException({
          message: 'An account already exists for this email address. Sign in instead.',
          field: 'email',
        });
      }
      if (target.includes('bookingPrefix')) {
        return new ConflictException({ message: 'A booking prefix collision occurred. Try a slightly different business name.', field: 'businessName' });
      }
      return new ConflictException(`These details are already registered (${slug})`);
    }
    return error;
  }

  private async suggestSlug(base: string) {
    for (let index = 2; index < 50; index += 1) {
      const candidate = `${base.slice(0, 56)}-${index}`;
      if (RESERVED_SLUGS.has(candidate)) {
        continue;
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!tenant) {
        return candidate;
      }
    }
    return undefined;
  }

  private async nextBookingPrefix(name: string) {
    const base = this.prefixFrom(name);
    const taken = new Set(
      (await this.prisma.tenant.findMany({ select: { bookingPrefix: true } })).map((tenant) => tenant.bookingPrefix),
    );

    if (!taken.has(base)) {
      return base;
    }

    for (let index = 2; index < 100; index += 1) {
      const suffix = String(index);
      const candidate = `${base.slice(0, Math.max(2, 10 - suffix.length))}${suffix}`;
      if (!taken.has(candidate)) {
        return candidate;
      }
    }

    throw new ConflictException('Could not allocate a booking prefix. Try a slightly different business name.');
  }

  private prefixFrom(name: string) {
    const words = name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const initials = words.map((word) => word[0]).join('');
    const compact = words.join('');
    const candidate = (initials.length >= 2 ? initials : compact).toUpperCase().replace(/[^A-Z0-9]/g, '');

    return (candidate.slice(0, 10) || 'STUDIO').padEnd(2, 'X');
  }

  private normalizeSlug(rawSlug: string) {
    return rawSlug.trim().toLowerCase();
  }

  private isValidSlug(slug: string) {
    return slug.length >= 2 && slug.length <= 60 && SLUG_PATTERN.test(slug);
  }

  private asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
