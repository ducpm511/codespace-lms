import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto, Paginated } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export function useNotifications(unreadOnly = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: () =>
      apiFetch<Paginated<NotificationDto>>(
        `/notifications?pageSize=20&unreadOnly=${unreadOnly ? 'true' : 'false'}`,
      ),
    refetchInterval: 30000, // poll every 30s for new notifications
  });

  const unreadCountQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiFetch<Paginated<NotificationDto>>('/notifications?unreadOnly=true&pageSize=1');
      return res.total;
    },
    refetchInterval: 30000,
  });

  const markAsRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch<NotificationDto>(`/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () =>
      apiFetch<{ count: number }>('/notifications/read-all', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    unreadCount: unreadCountQuery.data ?? 0,
    isLoading: query.isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
