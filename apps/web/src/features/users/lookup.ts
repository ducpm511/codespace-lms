import { useQuery } from '@tanstack/react-query';
import type { UserLookupDto } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export const lookupUser = (email: string): Promise<UserLookupDto> =>
  apiFetch<UserLookupDto>(`/users/lookup?email=${encodeURIComponent(email)}`);

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Tra người dùng theo email chính xác (để thêm vào lớp). Chỉ gọi khi chuỗi đã giống email
 * → không bắn request mỗi lần gõ phím. 404 = không tồn tại, KHÔNG retry.
 */
export function useUserLookup(email: string) {
  const normalized = email.trim().toLowerCase();
  return useQuery({
    queryKey: ['user-lookup', normalized],
    queryFn: () => lookupUser(normalized),
    enabled: looksLikeEmail(normalized),
    retry: false,
    staleTime: 60_000,
  });
}
