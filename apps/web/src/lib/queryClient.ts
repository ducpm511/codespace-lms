import { QueryClient } from '@tanstack/react-query';

// Client TanStack Query dùng chung. Cấu hình chi tiết mở rộng theo sk-react-query-patterns.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });
}

/** Base URL của API (đi qua proxy Vite ở dev). */
export const API_BASE = '/api';
