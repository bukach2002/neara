import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  sourceIp?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        summary: input.summary,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        sourceIp: input.sourceIp ?? null,
      },
    });
  }
}
