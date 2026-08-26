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

// --- T10.5 — dãy số liệu khu Quản trị ---

/**
 * Số liệu tổng quan khu Quản trị. Đếm bằng query cố định ở server (giống `GET /teach/overview`),
 * KHÔNG nạp hết bản ghi rồi đếm ở client — máy chạy thật chỉ có 2 GB RAM.
 *
 * Tài khoản đã khoá (`suspended`) KHÔNG được tính: một giáo viên bị khoá không còn dạy,
 * đếm vào thì con số nói dối.
 */
export interface AdminOverviewDto {
  /** Tài khoản đang hoạt động có vai trò `instructor` hoặc `teaching_assistant`. */
  teacherCount: number;
  /** Tài khoản đang hoạt động có vai trò `student`. */
  studentCount: number;
  /** Lớp `status = active`. */
  activeClassCount: number;
  /** Khóa học `status = published`. */
  publishedCourseCount: number;
}
