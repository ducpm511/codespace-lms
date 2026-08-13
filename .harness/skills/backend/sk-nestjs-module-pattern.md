# sk-nestjs-module-pattern

<!-- SKILL: NestJS Module Pattern -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: NestJS module, controller, service, guard -->

Mỗi domain là một module rõ ràng. Backend đứng giữa FE ↔ DB ↔ hệ thống ngoài.

## Cấu trúc một module
```
apps/api/src/<module>/
  <module>.module.ts
  <module>.controller.ts   # HTTP mỏng — điều phối, validate qua DTO
  <module>.service.ts      # business logic + invariants
  dto/                     # import type từ packages/contracts + decorator validate
  <module>.service.spec.ts
```

## Nguyên tắc
- Controller mỏng; logic ở service. Guard cho auth + ownership.
- Service áp invariants (ownership, idempotency, audit-in-transaction) — không rò ra controller.
- Prisma qua một `PrismaService` inject; ghi + audit trong cùng `$transaction`.
- Không import chéo apps/web. Type dùng chung lấy từ `packages/contracts`.
- Mọi list endpoint có pagination.

## Guard bắt buộc
- `AuthGuard` (session/token → user) trên route cần đăng nhập.
- Ownership check trong service cho route `:id` (xem `sk-idor-enforcement`).

## Không
- Business logic trong controller.
- Truy cập Prisma rải rác ngoài service.
- Endpoint trả toàn bộ record (chỉ field cần thiết).
