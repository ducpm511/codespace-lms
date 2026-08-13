# sk-schema-conventions

<!-- SKILL: Prisma Schema Conventions -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: Prisma model, schema, field, index, enum -->

## Relation vs soft-ref
- Tham chiếu **nội bộ**: FK cứng qua `@relation`, `onDelete` phù hợp.
- Tham chiếu tới **hệ thống ngoài** (nếu có, đồng bộ trễ): `String` + `@index`, cân nhắc KHÔNG FK cứng
  (eventual consistency — dữ liệu vận hành không vỡ khi bản cache chưa về).

## Unique constraint
- Thêm `@@unique([...])` cho mọi thao tác cần idempotent (tránh bản ghi trùng khi retry).

## Kiểu dữ liệu
- Giá trị cần chính xác: `Decimal @db.Decimal(p,s)` — không `Float`.
- Thời gian: `DateTime` lưu **UTC**.
- ID: `String @id @default(cuid())`.
- Enum cho tập giá trị cố định.

## Đặt tên
- Model PascalCase; field camelCase; enum value snake_case.
- `createdAt @default(now())`, `updatedAt @updatedAt`.

## Mở rộng
- Giữ enum "loại/type" cho các field có thể mở rộng về sau (không cần UI phức tạp ngay).

## [DOMAIN]
- _(điền unique constraint & ràng buộc riêng của dự án)_

## Không
- Bỏ unique của thao tác idempotent; `Float` cho giá trị cần chính xác.
