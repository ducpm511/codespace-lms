import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('findForUser returns paginated notifications', async () => {
    const mockNotif = {
      id: 'notif-1',
      userId: 'user-1',
      type: 'certificate.issued',
      title: 'Chứng chỉ mới',
      message: 'Bạn đã nhận chứng chỉ',
      payloadJson: { serialNo: 'CS-123' },
      readAt: null,
      createdAt: new Date('2026-08-17T10:00:00Z'),
    };
    prisma.notification.findMany.mockResolvedValue([mockNotif]);
    prisma.notification.count.mockResolvedValue(1);

    const result = await service.findForUser('user-1', { page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('notif-1');
    expect(result.items[0].payloadJson).toEqual({ serialNo: 'CS-123' });
  });

  it('getUnreadCount returns correct count', async () => {
    prisma.notification.count.mockResolvedValue(5);
    const result = await service.getUnreadCount('user-1');
    expect(result.unreadCount).toBe(5);
  });

  it('markAsRead updates notification if unread', async () => {
    const mockNotif = {
      id: 'notif-1',
      userId: 'user-1',
      type: 'info',
      title: 'Test',
      message: 'Msg',
      payloadJson: null,
      readAt: null,
      createdAt: new Date(),
    };
    prisma.notification.findUnique.mockResolvedValue(mockNotif);
    prisma.notification.update.mockResolvedValue({ ...mockNotif, readAt: new Date() });

    const result = await service.markAsRead('user-1', 'notif-1');
    expect(result.readAt).not.toBeNull();
    expect(prisma.notification.update).toHaveBeenCalled();
  });

  it('markAsRead throws 404 if not found or different user', async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(service.markAsRead('user-1', 'notif-999')).rejects.toThrow(NotFoundException);
  });

  it('markAllAsRead updates all unread notifications', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    const result = await service.markAllAsRead('user-1');
    expect(result.updatedCount).toBe(3);
  });
});
