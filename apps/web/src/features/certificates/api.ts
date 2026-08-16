import { apiFetch } from '../../lib/api';
import type {
  CertificateDto,
  CertificateTemplateDto,
  IssueCertificateRequest,
  PublicVerificationDto,
  RevokeCertificateRequest,
} from '@lms/contracts';

export function issueCertificate(data: IssueCertificateRequest): Promise<CertificateDto> {
  return apiFetch<CertificateDto>('/certificates/issue', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function revokeCertificate(id: string, data: RevokeCertificateRequest): Promise<CertificateDto> {
  return apiFetch<CertificateDto>(`/certificates/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listMyCertificates(): Promise<CertificateDto[]> {
  return apiFetch<CertificateDto[]>('/certificates/mine');
}

export function listClassCertificates(classId: string): Promise<CertificateDto[]> {
  return apiFetch<CertificateDto[]>(`/certificates/class/${encodeURIComponent(classId)}`);
}

export function listCertificateTemplates(): Promise<CertificateTemplateDto[]> {
  return apiFetch<CertificateTemplateDto[]>('/certificates/templates');
}

export function verifyCertificate(code: string): Promise<PublicVerificationDto> {
  return apiFetch<PublicVerificationDto>(`/verify/${encodeURIComponent(code)}`);
}
