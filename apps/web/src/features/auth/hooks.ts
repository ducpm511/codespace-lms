import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, LoginRequest } from '@lms/contracts';
import { getMe, login, logout } from './api';

export const meKey = ['auth', 'me'] as const;

/** Phiên hiện tại. retry:false để 401 (chưa đăng nhập) không lặp lại. */
export function useMe() {
  return useQuery<AuthUser>({
    queryKey: meKey,
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => login(body),
    onSuccess: (res) => {
      qc.setQueryData(meKey, res.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      qc.clear();
    },
  });
}
