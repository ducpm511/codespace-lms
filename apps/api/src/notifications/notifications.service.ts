import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import type { NotificationDto, Paginated, UnreadNotificationCountDto } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';

function toNotificationDto(n: {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  payloadJson: unknown;
  readAt: Date | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    payloadJson: (n.payloadJson as Record<string, unknown> | null) ?? null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(
    userId: string,
    query: { unreadOnly?: boolean; page?: number; pageSize?: number },
  ): Promise<Paginated<NotificationDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map(toNotificationDto),
      total,
      page,
      pageSize,
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadNotificationCountDto> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unreadCount: count };
  }

  async markAsRead(userId: string, id: string): Promise<NotificationDto> {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) {
      throw new NotFoundException('Thông báo không tồn tại');
    }
    if (notif.readAt) {
      return toNotificationDto(notif);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return toNotificationDto(updated);
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  /**
   * Helper tạo notification trong cùng transaction với hành động domain.
   */
  async createInTx(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      type: string;
      title: string;
      message: string;
      payloadJson?: Record<string, unknown>;
    },
  ) {
    return tx.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        payloadJson: (data.payloadJson as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  }
}
