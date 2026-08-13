# sk-idor-enforcement

<!-- SKILL: IDOR / Ownership Enforcement -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: Route có :id, ownership, role gate, auth -->

Backend là quyền lực cuối. UI ẩn nút chỉ là UX — **API vẫn phải chặn**.

## Nguyên tắc
- Mọi route `:id` phải kiểm **người dùng hiện tại có quyền với resource đó không**, ở tầng
  service/guard, TRƯỚC khi đọc/ghi.
- Quyền dựa trên quan hệ sở hữu/role lấy từ **session/server**, không từ tham số URL hay body client.

## Pattern (NestJS)
```ts
const resource = await this.repo.findById(id);
if (!resource) throw new NotFoundException();
if (!canAccess(user, resource)) throw new ForbiddenException();
```
Thứ tự: tồn tại → NotFound; quyền → Forbidden. Với yêu cầu bảo mật cao, cân nhắc trả NotFound cho cả
hai để không lộ sự tồn tại.

## Auth
- Session/token nhạy cảm nằm server-side; FE không giữ/không thấy.
- Không tin `role`/`ownerId` gửi từ client — lấy từ session.

## Test bắt buộc (3 nhánh)
```
authorized → OK · wrong-owner → Forbidden · not-found → NotFound
```

## Không
- Bỏ ownership check vì "UI đã ẩn rồi".
- Lấy role/ownership từ request body/query.
