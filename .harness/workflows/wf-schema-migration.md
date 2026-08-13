# wf-schema-migration

<!-- WORKFLOW: Schema + Migration -->
<!-- AGENTS: Codex / Claude -->
<!-- MAX: 120 lines. -->

Cho task đổi `prisma/schema.prisma` + migration.

## Skills
`.harness/skills/schema/sk-schema-conventions.md`, `.harness/skills/schema/sk-prisma-migration.md`,
`.harness/skills/backend/sk-prisma-data-rules.md`, `.harness/constraints/cx-hard-limits.md`.

## Steps
1. Đọc `prisma/schema.prisma` + phần liên quan `docs/DESIGN.md`.
2. Áp convention (`sk-schema-conventions`):
   - Unique constraint cho thao tác idempotent (tránh bản ghi trùng).
   - Giá trị cần chính xác dùng `Decimal`, không `Float`.
   - Timestamp `DateTime` lưu UTC.
   - Relation cứng cho tham chiếu nội bộ; cân nhắc soft-ref cho tham chiếu tới hệ thống ngoài.
   - **[DOMAIN]** ràng buộc riêng của dự án.
3. `npx prisma format && npx prisma validate`.
4. `npx prisma migrate dev --name <kebab-mô-tả>`.
5. Cập nhật `docs/DESIGN.md` nếu mô hình đổi; ghi ADR nếu là quyết định kiến trúc.
6. Thêm test cho bảng mới nếu liên quan luật nghiệp vụ (idempotency/ownership).
7. Handoff. Cập nhật `CURRENT_STATE.md` (schema đã đổi).

## Never
- Sửa migration đã commit — tạo migration mới.
- Bỏ unique constraint của thao tác idempotent.
- `prisma db push` cho thay đổi cần lịch sử migration.
