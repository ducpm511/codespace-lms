import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { IssueCertificateDto } from './dto/issue-certificate.dto';
import type { RevokeCertificateDto } from './dto/revoke-certificate.dto';
import type { CreateCertificateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly grading: GradingService,
  ) {}

  async issue(dto: IssueCertificateDto, currentUser: AuthUser): Promise<CertificateDto> {
    // 1) Scope permission check
    if (dto.classId) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.id);
      const canIssue = this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_ISSUE, dto.classId);
      if (!canIssue) {
        throw new ForbiddenException('Không có quyền cấp chứng chỉ cho lớp này');
      }
    }

    // 2) Check if user exists
    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) {
      throw new NotFoundException('Học viên không tồn tại');
    }

    // 3) Check if course exists
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }

    // 4) Check template exists
    const template = await this.prisma.certificateTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) {
      throw new NotFoundException('Mẫu chứng chỉ không tồn tại');
    }

    // 5) Check unique constraint (userId, courseId, classId)
    const existing = await this.prisma.certificate.findFirst({
      where: {
        userId: dto.userId,
        courseId: dto.courseId,
        classId: dto.classId ?? null,
      },
    });

    if (existing) {
      if (existing.revokedAt) {
        throw new ConflictException('Chứng chỉ của học viên cho khóa này đã bị thu hồi');
      }
      throw new ConflictException('Học viên đã được cấp chứng chỉ cho khóa học này');
    }

    // 6) Calculate finalScore from Gradebook / entries
    let finalScore = 85; // default pass score
    if (dto.classId) {
      const gradebook = await this.grading.getClassGradebook(dto.classId, currentUser);
      const userRow = gradebook.rows.find((r) => r.userId === dto.userId);
      if (userRow) {
        finalScore = userRow.totalWeightedScore;
      }
    }

    // 7) Generate unique serialNo & verificationCode
    const serialNo = `CS-CERT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const verificationCode = `VC-${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`.toLowerCase();

    // 8) Save Certificate and AuditLog in SAME transaction
    const [cert] = await this.prisma.$transaction([
      this.prisma.certificate.create({
        data: {
          userId: dto.userId,
          courseId: dto.courseId,
          classId: dto.classId ?? null,
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
          metaJson: { userId: dto.userId, courseId: dto.courseId, classId: dto.classId, serialNo },
        },
      }),
    ]);

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

    // Scope check
    if (cert.classId) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.id);
      const canRevoke = this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_REVOKE, cert.classId);
      if (!canRevoke) {
        throw new ForbiddenException('Không có quyền thu hồi chứng chỉ cho lớp này');
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
    ]);

    return toCertificateDto(updated);
  }

  async verify(code: string): Promise<PublicVerificationDto> {
    const cert = await this.prisma.certificate.findUnique({
      where: { verificationCode: code },
      include: {
        user: { select: { fullName: true } }, // ONLY display name, NO email / PII
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
      finalScore: Number(cert.finalScore),
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
    const eff = await this.rbac.getEffectivePermissions(currentUser.id);
    const canRead = this.rbac.hasPermission(eff, PERMISSIONS.CERTIFICATE_READ, classId);
    if (!canRead) {
      throw new ForbiddenException('Không có quyền xem danh sách chứng chỉ của lớp này');
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
}

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
