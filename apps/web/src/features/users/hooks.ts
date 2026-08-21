import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserRequest, UpdateUserRequest } from '@lms/contracts';
import * as api from './api';
import type { UserListQuery } from './api';

export const usersKey = ['users'] as const;
export const usersListKey = (q: UserListQuery) => ['users', 'list', q] as const;

/**
 * Danh sách người dùng có lọc ở server. `keepPreviousData` để đổi trang không nháy về
 * trạng thái loading — bảng giữ nguyên hàng cũ cho tới khi trang mới về.
 */
export function useUsers(query: UserListQuery, enabled = true) {
  return useQuery({
    queryKey: usersListKey(query),
    queryFn: () => api.listUsers(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Mọi mutation đều làm mới toàn bộ nhánh 'users' — trang/bộ lọc hiện tại nằm trong key. */
function useUsersMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useCreateUser() {
  return useUsersMutation((body: CreateUserRequest) => api.createUser(body));
}

export function useUpdateUser() {
  return useUsersMutation(({ id, body }: { id: string; body: UpdateUserRequest }) =>
    api.updateUser(id, body),
  );
}

export function useAssignRole() {
  return useUsersMutation(({ id, roleKey }: { id: string; roleKey: string }) =>
    api.assignRole(id, roleKey),
  );
}

export function useRevokeRole() {
  return useUsersMutation(({ id, roleKey }: { id: string; roleKey: string }) =>
    api.revokeRole(id, roleKey),
  );
}

/**
 * Đặt lại mật khẩu KHÔNG làm danh sách cũ đi (không đổi field nào hiển thị ở bảng),
 * nên không invalidate — tránh một lượt fetch thừa.
 */
export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.resetUserPassword(id, { newPassword }),
  });
}
