import { useQuery } from '@tanstack/react-query';
import type { AuditLogDto, AuditLogFilterQuery, Paginated } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

// Tên field khớp AuditLogFilterQuery — ValidationPipe của API bật forbidNonWhitelisted,
// nên gửi `from`/`to` (tên cũ) sẽ bị trả 400 chứ không phải bị bỏ qua.
export type AuditFilters = AuditLogFilterQuery;

export function useAuditLogs(filters: AuditFilters = {}, enabled = true) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters.actorId) params.append('actorId', filters.actorId);
  if (filters.action) params.append('action', filters.action);
  if (filters.entity) params.append('entity', filters.entity);
  if (filters.fromDate) params.append('fromDate', filters.fromDate);
  if (filters.toDate) params.append('toDate', filters.toDate);

  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => apiFetch<Paginated<AuditLogDto>>(`/audit-logs?${params.toString()}`),
    // Tab Nhật ký chưa mở thì đừng bắn query — /audit là một lượt quét bảng có phân trang.
    enabled,
    staleTime: 30000,
  });
}
