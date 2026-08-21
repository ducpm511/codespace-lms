import type {
  CreateUserRequest,
  Paginated,
  PasswordChangeResult,
  ResetPasswordRequest,
  UpdateUserRequest,
  UserDetail,
  UserSummary,
} from '@lms/contracts';
import { apiFetch } from '../../lib/api';

/** Bộ lọc danh sách người dùng — chạy Ở SERVER (xem ListUsersQueryDto ở apps/api). */
export interface UserListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  roleKey?: string;
}

function toQueryString(q: UserListQuery): string {
  const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
  if (q.search?.trim()) params.set('search', q.search.trim());
  if (q.status) params.set('status', q.status);
  if (q.roleKey) params.set('roleKey', q.roleKey);
  return params.toString();
}

export const listUsers = (q: UserListQuery): Promise<Paginated<UserSummary>> =>
  apiFetch<Paginated<UserSummary>>(`/users?${toQueryString(q)}`);

export const createUser = (body: CreateUserRequest): Promise<UserDetail> =>
  apiFetch<UserDetail>('/users', { method: 'POST', body: JSON.stringify(body) });

export const updateUser = (id: string, body: UpdateUserRequest): Promise<UserDetail> =>
  apiFetch<UserDetail>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const assignRole = (id: string, roleKey: string): Promise<UserDetail> =>
  apiFetch<UserDetail>(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify({ roleKey }) });

export const revokeRole = (id: string, roleKey: string): Promise<UserDetail> =>
  apiFetch<UserDetail>(`/users/${id}/roles/${encodeURIComponent(roleKey)}`, { method: 'DELETE' });

/**
 * Admin đặt lại mật khẩu. Server KHÔNG gửi mật khẩu đi đâu cả — admin đọc từ form
 * và tự chuyển cho học viên (chưa có email provider, xem T9.6).
 */
export const resetUserPassword = (
  id: string,
  body: ResetPasswordRequest,
): Promise<PasswordChangeResult> =>
  apiFetch<PasswordChangeResult>(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
