import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  issueCertificate,
  listClassCertificates,
  listCertificateTemplates,
  listMyCertificates,
  revokeCertificate,
  verifyCertificate,
} from './api';
import type { IssueCertificateRequest, RevokeCertificateRequest } from '@lms/contracts';

export function useMyCertificates() {
  return useQuery({
    queryKey: ['myCertificates'],
    queryFn: () => listMyCertificates(),
  });
}

export function useClassCertificates(classId: string | null) {
  return useQuery({
    queryKey: ['classCertificates', classId],
    queryFn: () => listClassCertificates(classId!),
    enabled: Boolean(classId),
  });
}

export function useCertificateTemplates() {
  return useQuery({
    queryKey: ['certificateTemplates'],
    queryFn: () => listCertificateTemplates(),
  });
}

export function useVerifyCertificate(code: string | null) {
  return useQuery({
    queryKey: ['verifyCertificate', code],
    queryFn: () => verifyCertificate(code!),
    enabled: Boolean(code),
    retry: false,
  });
}

export function useIssueCertificate(classId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IssueCertificateRequest) => issueCertificate(data),
    onSuccess: () => {
      if (classId) {
        queryClient.invalidateQueries({ queryKey: ['classCertificates', classId] });
      }
      queryClient.invalidateQueries({ queryKey: ['myCertificates'] });
    },
  });
}

export function useRevokeCertificate(classId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RevokeCertificateRequest }) => revokeCertificate(id, data),
    onSuccess: () => {
      if (classId) {
        queryClient.invalidateQueries({ queryKey: ['classCertificates', classId] });
      }
      queryClient.invalidateQueries({ queryKey: ['myCertificates'] });
    },
  });
}
