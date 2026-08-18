import { Injectable } from '@nestjs/common';
import { Prisma } from '@lms/database';
import type { AuditLogDto, Paginated } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findLogs(query: AuditQueryDto): Promise<Paginated<AuditLogDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.entity) {
      where.entity = { contains: query.entity, mode: 'insensitive' };
    }
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate);
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actorName: log.actor?.fullName ?? null,
        actorEmail: log.actor?.email ?? null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metaJson: (log.metaJson as Record<string, unknown> | null) ?? null,
        ip: log.ip,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
