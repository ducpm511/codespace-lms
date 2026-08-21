// Hợp đồng auth dùng chung FE↔BE. Chỉ type/shape — KHÔNG logic, KHÔNG validation runtime.
// Nguồn: docs/DESIGN.md §5.1, §8. DTO có decorator (class-validator) nằm ở apps/api.

/** Body đăng nhập. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Người dùng đã xác thực + quyền hiệu lực (roles + permission keys). */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  status: string;
  roles: string[];
  permissions: string[];
}

/** Trả về khi login: access token (đặt ở memory FE) + thông tin user. Refresh token đi qua cookie httpOnly. */
export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

/** Trả về khi refresh: access token mới (cookie refresh được xoay vòng phía server). */
export interface RefreshResponse {
  accessToken: string;
}

/** Độ dài mật khẩu tối thiểu — dùng chung cho DTO ở API và validate form ở web. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

/** Body đổi mật khẩu tự phục vụ (`POST /auth/change-password`). */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Kết quả đổi/đặt lại mật khẩu. `revokedSessions` = số refresh token bị thu hồi:
 * đổi mật khẩu là đá TẤT CẢ thiết bị ra, kể cả thiết bị đang thao tác.
 */
export interface PasswordChangeResult {
  revokedSessions: number;
}
