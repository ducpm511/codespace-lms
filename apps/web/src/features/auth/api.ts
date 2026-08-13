import type { AuthUser, LoginRequest, LoginResponse } from '@lms/contracts';
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
