import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  PasswordChangeResult,
} from '@lms/contracts';
import { apiFetch, setAccessToken } from '../../lib/api';

export async function login(body: LoginRequest): Promise<LoginResponse> {
  // retryOn401=false: sai mật khẩu không nên kích hoạt refresh.
  const res = await apiFetch<LoginResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(body) },
    false,
  );
  setAccessToken(res.accessToken);
  return res;
}

export async function logout(): Promise<void> {
  await apiFetch<{ success: true }>('/auth/logout', { method: 'POST' }, false);
  setAccessToken(null);
}

export function getMe(): Promise<AuthUser> {
  // Khi boot lại trang: token in-memory rỗng → apiFetch tự refresh bằng cookie httpOnly rồi thử lại.
  return apiFetch<AuthUser>('/auth/me');
}

/**
 * Đổi mật khẩu. Server thu hồi TẤT CẢ refresh token nên phiên hiện tại cũng chết —
 * caller phải xoá access token trong bộ nhớ và đưa người dùng về trang đăng nhập.
 */
export async function changePassword(body: ChangePasswordRequest): Promise<PasswordChangeResult> {
  const res = await apiFetch<PasswordChangeResult>(
    '/auth/change-password',
    { method: 'POST', body: JSON.stringify(body) },
    false, // 401 ở đây = sai mật khẩu hiện tại, KHÔNG phải token hết hạn -> đừng refresh rồi thử lại
  );
  setAccessToken(null);
  return res;
}
