import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types';
import { CertificatesService } from './certificates.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import type { GradingService } from '../grading/grading.service';

const dummyAdmin: AuthPrincipal = { userId: 'admin1' };

function makePrisma() {
  return {
    user: { findUnique: jest.fn() },
    course: { findUnique: jest.fn() },
    certificateTemplate: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    certificate: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    lessonProgress: { count: jest.fn() },
    auditLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    file: { create: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeRbac() {
  return {
    getEffectivePermissions: jest.fn().mockResolvedValue([]),
    hasPermission: jest.fn().mockReturnValue(true),
  };
}

function makeGrading() {
  const gradebook = {
    classId: 'c1',
    items: [],
    rows: [{ userId: 'u1', totalWeightedScore: 92 }],
  };
  return {
    getClassGradebook: jest.fn().mockResolvedValue(gradebook),
    recomputeClassGradebook: jest.fn().mockResolvedValue(gradebook),
  };
}

describe('CertificatesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let rbac: ReturnType<typeof makeRbac>;
  let grading: ReturnType<typeof makeGrading>;
  let service: CertificatesService;

  beforeEach(() => {
    prisma = makePrisma();
    rbac = makeRbac();
    grading = makeGrading();
    service = new CertificatesService(
      prisma as unknown as PrismaService,
      rbac as unknown as RbacService,
      grading as unknown as GradingService,
    );
  });

  describe('issue', () => {
    it('404 khi học viên không tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.issue({ userId: 'ghost', courseId: 'cr1', classId: 'c1', templateId: 't1' }, dummyAdmin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 khi học viên đã được cấp chứng chỉ cho khóa', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.course.findUnique.mockResolvedValue({ id: 'cr1', sections: [] });
      prisma.certificateTemplate.findUnique.mockResolvedValue({ id: 't1' });
      prisma.certificate.findFirst.mockResolvedValue({ id: 'cert1', revokedAt: null });

      await expect(
        service.issue({ userId: 'u1', courseId: 'cr1', classId: 'c1', templateId: 't1' }, dummyAdmin),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('cấp chứng chỉ thành công và ghi AuditLog trong cùng transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', fullName: 'Học Viên A' });
      prisma.course.findUnique.mockResolvedValue({ id: 'cr1', title: 'Python Cơ Bản', sections: [] });
      prisma.certificateTemplate.findUnique.mockResolvedValue({ id: 't1', name: 'Standard' });
      prisma.certificate.findFirst.mockResolvedValue(null);
      prisma.lessonProgress.count.mockResolvedValue(0);

      const mockCertCreated = {
        id: 'cert-100',
        userId: 'u1',
        courseId: 'cr1',
        templateId: 't1',
        serialNo: 'CS-CERT-2026-ABC123',
        verificationCode: 'vc-xyz789',
        finalScore: '92',
        issuedById: 'admin1',
        issuedAt: new Date('2026-08-16T10:00:00Z'),
        revokedAt: null,
        user: { fullName: 'Học Viên A' },
        course: { title: 'Python Cơ Bản' },
        issuedBy: { fullName: 'Admin B' },
      };

      prisma.certificate.create.mockResolvedValue(mockCertCreated);
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const res = await service.issue(
        { userId: 'u1', courseId: 'cr1', classId: 'c1', templateId: 't1' },
        dummyAdmin,
      );

      expect(res.id).toBe('cert-100');
      expect(res.serialNo).toBe('CS-CERT-2026-ABC123');
      expect(res.finalScore).toBe(92);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('404 khi không tìm thấy chứng chỉ', async () => {
      prisma.certificate.findUnique.mockResolvedValue(null);
      await expect(
        service.revoke('cert-ghost', { reason: 'Vi phạm' }, dummyAdmin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400 khi chứng chỉ đã bị thu hồi trước đó', async () => {
      prisma.certificate.findUnique.mockResolvedValue({
        id: 'c1',
        revokedAt: new Date(),
      });
      await expect(
        service.revoke('c1', { reason: 'Vi phạm' }, dummyAdmin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('thu hồi chứng chỉ thành công và ghi AuditLog', async () => {
      prisma.certificate.findUnique.mockResolvedValue({
        id: 'cert-100',
        serialNo: 'CS-CERT-123',
        revokedAt: null,
        user: { fullName: 'Học Viên A' },
        course: { title: 'Python' },
        issuedBy: { fullName: 'Admin' },
      });

      const mockRevoked = {
        id: 'cert-100',
        serialNo: 'CS-CERT-123',
        finalScore: '90',
        issuedAt: new Date(),
        revokedAt: new Date(),
        revokedReason: 'Gian lận',
        user: { fullName: 'Học Viên A' },
        course: { title: 'Python' },
        issuedBy: { fullName: 'Admin' },
      };

      prisma.certificate.update.mockResolvedValue(mockRevoked);
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });

      const res = await service.revoke('cert-100', { reason: 'Gian lận' }, dummyAdmin);
      expect(res.revokedReason).toBe('Gian lận');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('403 khi không có quyền revoke (scope theo cert.classId)', async () => {
      prisma.certificate.findUnique.mockResolvedValue({ id: 'cert-100', classId: 'class-9', revokedAt: null });
      rbac.hasPermission.mockReturnValue(false);

      await expect(
        service.revoke('cert-100', { reason: 'Gian lận' }, { userId: 'nguoi-la' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Hồi quy: phải tra quyền bằng userId THẬT, không phải undefined
      expect(rbac.getEffectivePermissions).toHaveBeenCalledWith('nguoi-la');
      expect(rbac.hasPermission).toHaveBeenCalledWith(expect.anything(), 'certificate.revoke', 'class-9');
      expect(prisma.certificate.update).not.toHaveBeenCalled();
    });
  });

  describe('listMine', () => {
    it('chỉ lấy chứng chỉ của chính user (lọc theo userId thật, không undefined)', async () => {
      prisma.certificate.findMany.mockResolvedValue([]);

      await service.listMine({ userId: 'hv-7' });

      expect(prisma.certificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'hv-7' } }),
      );
    });
  });

  describe('getPdfBuffer (IDOR)', () => {
    it('403 khi không phải chủ sở hữu và không có certificate.read', async () => {
      prisma.certificate.findUnique.mockResolvedValue({
        id: 'cert-1',
        userId: 'chu-so-huu',
        classId: 'class-3',
        user: { fullName: 'A' },
        course: { title: 'Python' },
      });
      rbac.hasPermission.mockReturnValue(false);

      await expect(service.getPdfBuffer('cert-1', { userId: 'ke-tro-mo' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(rbac.getEffectivePermissions).toHaveBeenCalledWith('ke-tro-mo');
    });
  });

  describe('verify', () => {
    it('404 khi mã xác thực không tồn tại', async () => {
      prisma.certificate.findUnique.mockResolvedValue(null);
      await expect(service.verify('invalid-code')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('xác thực thành công và trả về thông tin không chứa PII nhạy cảm', async () => {
      prisma.certificate.findUnique.mockResolvedValue({
        serialNo: 'CS-CERT-2026-ABC123',
        verificationCode: 'vc-xyz789',
        finalScore: '95',
        issuedAt: new Date('2026-08-16T10:00:00Z'),
        revokedAt: null,
        user: { fullName: 'Nguyễn Văn A' }, // display name only
        course: { title: 'Lập trình Scratch' },
      });

      const res = await service.verify('vc-xyz789');
      expect(res.serialNo).toBe('CS-CERT-2026-ABC123');
      expect(res.studentName).toBe('Nguyễn Văn A');
      expect(res.courseTitle).toBe('Lập trình Scratch');
      expect(res.status).toBe('valid');
      expect((res as unknown as Record<string, unknown>).email).toBeUndefined();
    });
  });
});
