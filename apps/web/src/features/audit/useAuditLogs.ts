import { useQuery } from '@tanstack/react-query';
import type { AuditLogDto, Paginated } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export interface AuditFilters {
  actorId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLogs(filters: AuditFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters.actorId) params.append('actorId', filters.actorId);
  if (filters.action) params.append('action', filters.action);
  if (filters.entity) params.append('entity', filters.entity);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);

  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => apiFetch<Paginated<AuditLogDto>>(`/audit?${params.toString()}`),
    staleTime: 30000,
  });
}
