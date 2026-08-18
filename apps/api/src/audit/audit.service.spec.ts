import { Test } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('findLogs returns paginated and filtered logs', async () => {
    const mockLog = {
      id: 'log-1',
      actorId: 'user-admin',
      action: 'certificate.issue',
      entity: 'Certificate',
      entityId: 'CS-123456',
      metaJson: { finalScore: 90 },
      ip: '127.0.0.1',
      createdAt: new Date('2026-08-17T10:00:00Z'),
      actor: { fullName: 'Admin User', email: 'admin@codespace.vn' },
    };
    prisma.auditLog.findMany.mockResolvedValue([mockLog]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.findLogs({
      entity: 'Certificate',
      action: 'certificate.issue',
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].actorName).toBe('Admin User');
    expect(result.items[0].entity).toBe('Certificate');
    expect(result.items[0].metaJson).toEqual({ finalScore: 90 });
  });
});
