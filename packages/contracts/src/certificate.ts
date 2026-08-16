// Hợp đồng Chứng chỉ (Certificate & Verification). Chỉ type/interface — KHÔNG logic. docs/DESIGN.md §4.7, §5.3.

export interface CertificateTemplateDto {
  id: string;
  name: string;
  backgroundFileId?: string | null;
  layoutJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CertificateDto {
  id: string;
  userId: string;
  classId?: string | null;
  courseId: string;
  templateId: string;
  serialNo: string;
  verificationCode: string;
  finalScore: number;
  issuedAt: string;
  issuedById: string;
  pdfFileId?: string | null;
  revokedAt?: string | null;
  revokedReason?: string | null;
  userFullName?: string;
  courseTitle?: string;
  issuerFullName?: string;
}

/** Thông tin xác thực công khai (/verify/:code) — KHÔNG PII nhạy cảm (không email/địa chỉ). */
export interface PublicVerificationDto {
  serialNo: string;
  verificationCode: string;
  studentName: string;
  courseTitle: string;
  finalScore: number;
  issuedAt: string;
  status: 'valid' | 'revoked';
  revokedAt?: string | null;
}

export interface IssueCertificateRequest {
  userId: string;
  courseId: string;
  classId?: string;
  templateId: string;
}

export interface RevokeCertificateRequest {
  reason: string;
}

export interface CreateCertificateTemplateRequest {
  name: string;
  backgroundFileId?: string;
  layoutJson?: Record<string, unknown>;
}
