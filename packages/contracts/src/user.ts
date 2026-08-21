// Hợp đồng user. Chỉ type — decorator validate ở apps/api.

export type UserStatusValue = 'invited' | 'active' | 'suspended';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: string[];
  createdAt: string;
}

/**
 * Kết quả tra cứu người dùng theo email CHÍNH XÁC, dùng khi thêm học viên vào lớp.
 * Cố ý tối giản: KHÔNG lộ role/status/thời điểm tạo — surface này mở cho giáo viên
 * (quyền `class.manage`), rộng hơn `user.read` của admin.
 */
export interface UserLookupDto {
  id: string;
  email: string;
  fullName: string;
}

export interface UserDetail extends UserSummary {
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  status?: UserStatusValue;
  roleKeys?: string[];
}

export interface UpdateUserRequest {
  fullName?: string;
  status?: UserStatusValue;
  avatarUrl?: string | null;
}

/** Body admin đặt lại mật khẩu cho người khác (`POST /users/:id/reset-password`). */
export interface ResetPasswordRequest {
  newPassword: string;
}
