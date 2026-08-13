# sk-react-query-patterns

<!-- SKILL: TanStack Query Patterns -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: useQuery, useMutation, TanStack, fetch, optimistic -->

Dùng TanStack Query cho mọi data fetching/cache/mutation. Type lấy từ `packages/contracts`.

## Query keys
Nhất quán, phân cấp: `['items']`, `['item', id]`, `['item', id, 'children']`.

## Optimistic + rollback (thao tác ghi nhanh/nhiều)
```
onMutate: cancel queries → snapshot cache → set optimistic
onError:  rollback về snapshot
onSettled: invalidate query key
```
- Với thao tác ghi lặp nhiều trong điều kiện mạng kém: cân nhắc **local draft** + sync lại qua
  endpoint **idempotent** (upsert) khi có mạng — retry an toàn, không nhân đôi.

## Nguyên tắc
- Không tự đoán response shape — import type từ contracts.
- Xử lý 401 → điều hướng login; 403 → thông báo không có quyền.
- Không giữ token ở FE (session qua cookie/httpOnly do backend set).

## Không
- Fetch thủ công bằng `fetch` rải rác ngoài Query (mất cache/invalidation).
- Optimistic mà không có rollback.
