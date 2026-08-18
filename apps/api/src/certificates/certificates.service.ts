import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@lms/database';
import {
  PERMISSIONS,
  type AuthUser,
  type CertificateDto,
  type CertificateTemplateDto,
  type PublicVerificationDto,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { GradingService } from '../grading/grading.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';
import { generateCertificatePdf } from './pdf/certificate-pdf.generator';
import type { IssueCertificateDto } from './dto/issue-certificate.dto';
import type { RevokeCertificateDto } from './dto/revoke-certificate.dto';
import type { CreateCertificateTemplateDto } from './dto/create-template.dto';

interface CertWithRelations {
  id: string;
  userId: string;
  classId?: string | null;
  courseId: string;
  templateId: string;
  serialNo: string;
  verificationCode: string;
  finalScore: Prisma.Decimal | number;
  issuedAt: Date;
  issuedById: string;
  pdfFileId?: string | null;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  user?: { fullName: string };
  course?: { title: string };
  issuedBy?: { fullName: string };
}

interface TemplateRecord {
  id: string;
  name: string;
  backgroundFileId?: string | null;
  layoutJson?: Prisma.JsonValue;
  createdAt: Date;
}

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly grading: GradingService,
    @Inject(STORAGE_ADAPTER) @Optional() private readonly storage?: StorageAdapter,
  ) {}

  async issue(dto: IssueCertificateDto, currentUser: AuthUser): Promise<CertificateDto> {
    if (!dto.classId) {
      throw new BadRequestException('Vui lòng chỉ định lớp học để cấp chứng chỉ');
    }

    // 1) Scope permission check
    const isSuperAdmin = currentUser.roles?.includes('super_admin');
    const isAdmin = currentUser.roles?.includes('admin');
    if (!isSuperAdmin && !isAdmin) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.id);
      const canIssue = this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_ISSUE, dto.classId);
      if (!canIssue) {
        throw new ForbiddenException('Không có quyền cấp chứng chỉ cho lớp này');
      }
    }

    // 2) Check targetUser
    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) {
      throw new NotFoundException('Học viên không tồn tại');
    }

    // 3) Check course & fetch sections/lessons for completion rate check
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: {
        sections: {
          include: {
            lessons: true,
          },
        },
      },
    });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }

    // 4) Check template
    const template = await this.prisma.certificateTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) {
      throw new NotFoundException('Mẫu chứng chỉ không tồn tại');
    }

    // 5) Check unique constraint (userId, courseId, classId)
    const existing = await this.prisma.certificate.findFirst({
      where: {
        userId: dto.userId,
        courseId: dto.courseId,
        classId: dto.classId,
      },
    });

    if (existing) {
      if (existing.revokedAt) {
        throw new ConflictException('Chứng chỉ của học viên cho khóa này đã bị thu hồi');
      }
      throw new ConflictException('Học viên đã được cấp chứng chỉ cho khóa học này');
    }

    // 6) Validate completion criteria (§5.3): lesson completion rate >= 80% & finalScore >= passScore (60%)
    // Chỉ tính bài học THUỘC khóa này (tránh đếm nhầm bài của course khác trong cùng lớp)
    const courseLessonIds = course.sections.flatMap((sec) => sec.lessons.map((l) => l.id));
    const totalLessons = courseLessonIds.length;

    if (totalLessons > 0) {
      const completedCount = await this.prisma.lessonProgress.count({
        where: {
          userId: dto.userId,
          classId: dto.classId,
          lessonId: { in: courseLessonIds },
          status: 'completed',
        },
      });
      const completionRate = Math.round((completedCount / totalLessons) * 100);
      if (completionRate < 80) {
        throw new UnprocessableEntityException(
          `Học viên chưa hoàn thành đủ số bài học (${completionRate}% / 80% tối thiểu)`,
        );
      }
    }

    // Tính finalScore từ sổ điểm — recompute (GHI) vì issue là thao tác write, cần dữ liệu mới nhất
    const gradebook = await this.grading.recomputeClassGradebook(dto.classId, currentUser);
    const userRow = gradebook.rows.find((r) => r.userId === dto.userId);

    if (!userRow) {
      throw new BadRequestException('Học viên không nằm trong danh sách lớp học này');
    }

    const finalScore = userRow.totalWeightedScore;
    const passScore = 60; // minimum pass score threshold
    if (finalScore < passScore) {
      throw new UnprocessableEntityException(
        `Điểm tổng kết của học viên (${finalScore}%) chưa đạt ngưỡng tối thiểu (${passScore}%) để cấp chứng chỉ`,
      );
    }

    // 7) Generate cryptographically secure serialNo & verificationCode (M2 fix with retry)
    let attempts = 0;
    let cert: CertWithRelations | null = null;

    while (attempts < 3) {
      attempts++;
      const year = new Date().getFullYear();
      const serialNo = `CS-CERT-${year}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const verificationCode = `VC-${randomBytes(12).toString('hex')}`;

      try {
        const [created] = await this.prisma.$transaction([
          this.prisma.certificate.create({
            data: {
              userId: dto.userId,
              courseId: dto.courseId,
              classId: dto.classId,
              templateId: dto.templateId,
              serialNo,
              verificationCode,
              finalScore: new Prisma.Decimal(finalScore),
              issuedById: currentUser.id,
              issuedAt: new Date(),
            },
            include: {
              user: { select: { fullName: true } },
              course: { select: { title: true } },
              issuedBy: { select: { fullName: true } },
            },
          }),
          this.prisma.auditLog.create({
            data: {
              actorId: currentUser.id,
              action: 'certificate.issue',
              entity: 'Certificate',
              entityId: serialNo,
              metaJson: { userId: dto.userId, courseId: dto.courseId, classId: dto.classId, serialNo, finalScore },
            },
          }),
          this.prisma.notification.create({
            data: {
              userId: dto.userId,
              type: 'certificate.issued',
              title: 'Chúc mừng bạn đã nhận chứng chỉ mới! 🎓',
              message: `Chứng chỉ khóa học đã được cấp thành công. Mã xác thực: ${verificationCode}`,
              payloadJson: { serialNo, verificationCode, courseId: dto.courseId, classId: dto.classId },
            },
          }),
        ]);

        cert = created;
        break;
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempts < 3) {
          continue; // retry code generation on unique collision
        }
        throw err;
      }
    }

    if (!cert) {
      throw new BadRequestException('Tạo chứng chỉ không thành công');
    }

    if (this.storage) {
      try {
        const pdfBuffer = await generateCertificatePdf({
          studentName: cert.user?.fullName ?? 'Hoc vien',
          courseTitle: cert.course?.title ?? 'Khoa hoc',
          serialNo: cert.serialNo,
          verificationCode: cert.verificationCode,
          issuedAt: cert.issuedAt,
          finalScore: Number(cert.finalScore),
        });

        const storageKey = `certificates/${cert.id}.pdf`;
        await this.storage.put(storageKey, pdfBuffer, 'application/pdf');

        const file = await this.prisma.file.create({
          data: {
            ownerId: cert.userId,
            provider: 'local',
            storageKey,
            mime: 'application/pdf',
            sizeBytes: pdfBuffer.length,
            visibility: 'private',
          },
        });

        const withPdf = await this.prisma.certificate.update({
          where: { id: cert.id },
          data: { pdfFileId: file.id },
          include: {
            user: { select: { fullName: true } },
            course: { select: { title: true } },
            issuedBy: { select: { fullName: true } },
          },
        });
        return toCertificateDto(withPdf);
      } catch {
        // PDF generation fallback gracefully
      }
    }

    return toCertificateDto(cert);
  }

  async revoke(id: string, dto: RevokeCertificateDto, currentUser: AuthUser): Promise<CertificateDto> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true } },
        course: { select: { title: true } },
        issuedBy: { select: { fullName: true } },
      },
    });

    if (!cert) {
      throw new NotFoundException('Chứng chỉ không tồn tại');
    }

    if (cert.revokedAt) {
      throw new BadRequestException('Chứng chỉ này đã bị thu hồi trước đó');
    }

    // M1 fix: Scope check in service for cert.classId or global admin
    const isSuperAdmin = currentUser.roles?.includes('super_admin');
    const isAdmin = currentUser.roles?.includes('admin');
    if (!isSuperAdmin && !isAdmin) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.id);
      const canRevoke = cert.classId
        ? this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_REVOKE, cert.classId)
        : this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_REVOKE);

      if (!canRevoke) {
        throw new ForbiddenException('Không có quyền thu hồi chứng chỉ này');
      }
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.certificate.update({
        where: { id },
        data: {
          revokedAt: new Date(),
          revokedReason: dto.reason,
        },
        include: {
          user: { select: { fullName: true } },
          course: { select: { title: true } },
          issuedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: 'certificate.revoke',
          entity: 'Certificate',
          entityId: cert.id,
          metaJson: { reason: dto.reason, serialNo: cert.serialNo },
        },
      }),
      this.prisma.notification.create({
        data: {
          userId: cert.userId,
          type: 'certificate.revoked',
          title: 'Thông báo thu hồi chứng chỉ',
          message: `Chứng chỉ số ${cert.serialNo} đã bị thu hồi. Lý do: ${dto.reason}`,
          payloadJson: { serialNo: cert.serialNo, reason: dto.reason },
        },
      }),
    ]);

    return toCertificateDto(updated);
  }

  async verify(code: string): Promise<PublicVerificationDto> {
    const cert = await this.prisma.certificate.findUnique({
      where: { verificationCode: code },
      include: {
        user: { select: { fullName: true } }, // ONLY display name, ZERO PII
        course: { select: { title: true } },
      },
    });

    if (!cert) {
      throw new NotFoundException('Mã xác thực chứng chỉ không tồn tại');
    }

    return {
      serialNo: cert.serialNo,
      verificationCode: cert.verificationCode,
      studentName: cert.user.fullName,
      courseTitle: cert.course.title,
      issuedAt: cert.issuedAt.toISOString(),
      status: cert.revokedAt ? 'revoked' : 'valid',
      revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    };
  }

  async listMine(currentUser: AuthUser): Promise<CertificateDto[]> {
    const certs = await this.prisma.certificate.findMany({
      where: { userId: currentUser.id },
      orderBy: { issuedAt: 'desc' },
      include: {
        user: { select: { fullName: true } },
        course: { select: { title: true } },
        issuedBy: { select: { fullName: true } },
      },
    });
    return certs.map(toCertificateDto);
  }

  async listForClass(classId: string, currentUser: AuthUser): Promise<CertificateDto[]> {
    const isSuperAdmin = currentUser.roles?.includes('super_admin');
    const isAdmin = currentUser.roles?.includes('admin');
    if (!isSuperAdmin && !isAdmin) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.id);
      const canRead = this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_READ, classId);
      if (!canRead) {
        throw new ForbiddenException('Không có quyền xem danh sách chứng chỉ của lớp này');
      }
    }

    const certs = await this.prisma.certificate.findMany({
      where: { classId },
      orderBy: { issuedAt: 'desc' },
      include: {
        user: { select: { fullName: true } },
        course: { select: { title: true } },
        issuedBy: { select: { fullName: true } },
      },
    });
    return certs.map(toCertificateDto);
  }

  // Certificate Template CRUD
  async listTemplates(): Promise<CertificateTemplateDto[]> {
    const templates = await this.prisma.certificateTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return templates.map(toTemplateDto);
  }

  async createTemplate(dto: CreateCertificateTemplateDto): Promise<CertificateTemplateDto> {
    const created = await this.prisma.certificateTemplate.create({
      data: {
        name: dto.name,
        backgroundFileId: dto.backgroundFileId ?? null,
        layoutJson: (dto.layoutJson as Prisma.InputJsonValue) ?? undefined,
      },
    });
    return toTemplateDto(created);
  }

  async getPdfBuffer(id: string, currentUser: AuthUser): Promise<{ buffer: Buffer; fileName: string }> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true } },
        course: { select: { title: true } },
      },
    });
    if (!cert) {
      throw new NotFoundException('Chứng chỉ không tồn tại');
    }

    if (cert.userId !== currentUser.id) {
      const isSuperAdmin = currentUser.roles?.includes('super_admin');
      const isAdmin = currentUser.roles?.includes('admin');
      if (!isSuperAdmin && !isAdmin) {
        const eff = await this.rbac.getEffectivePermissions(currentUser.id);
        const canRead = cert.classId
          ? this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_READ, cert.classId)
          : this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_READ);
        if (!canRead) {
          throw new ForbiddenException('Không có quyền tải chứng chỉ này');
        }
      }
    }

    let buffer: Buffer | null = null;
    if (cert.pdfFileId && this.storage) {
      const file = await this.prisma.file.findUnique({ where: { id: cert.pdfFileId } });
      if (file) {
        try {
          buffer = await this.storage.get(file.storageKey);
        } catch {
          buffer = null;
        }
      }
    }

    if (!buffer) {
      buffer = await generateCertificatePdf({
        studentName: cert.user?.fullName ?? 'Hoc vien',
        courseTitle: cert.course?.title ?? 'Khoa hoc',
        serialNo: cert.serialNo,
        verificationCode: cert.verificationCode,
        issuedAt: cert.issuedAt,
        finalScore: Number(cert.finalScore),
      });
    }

    return {
      buffer,
      fileName: `certificate-${cert.serialNo}.pdf`,
    };
  }
}

function toCertificateDto(cert: CertWithRelations): CertificateDto {
  return {
    id: cert.id,
    userId: cert.userId,
    classId: cert.classId,
    courseId: cert.courseId,
    templateId: cert.templateId,
    serialNo: cert.serialNo,
    verificationCode: cert.verificationCode,
    finalScore: Number(cert.finalScore),
    issuedAt: cert.issuedAt.toISOString(),
    issuedById: cert.issuedById,
    pdfFileId: cert.pdfFileId,
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    revokedReason: cert.revokedReason,
    userFullName: cert.user?.fullName,
    courseTitle: cert.course?.title,
    issuerFullName: cert.issuedBy?.fullName,
  };
}

function toTemplateDto(template: TemplateRecord): CertificateTemplateDto {
  return {
    id: template.id,
    name: template.name,
    backgroundFileId: template.backgroundFileId,
    layoutJson: template.layoutJson as Record<string, unknown> | null,
    createdAt: template.createdAt.toISOString(),
  };
}
