// Hợp đồng AuditLog dùng chung FE <-> BE. Nguồn: docs/DESIGN.md §4.8.

export interface AuditLogDto {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId: string;
  metaJson?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
}

export interface AuditLogFilterQuery {
  actorId?: string;
  entity?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}
