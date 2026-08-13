# @lms/database

Sở hữu **Prisma schema + migrations + generated client** — nguồn sự thật dữ liệu của LMS.

- Schema: `prisma/schema.prisma`
- Client sinh ra: `generated/client/` (gitignore, tạo bằng `pnpm --filter @lms/database generate`)
- App backend dùng qua `import { PrismaClient } from '@lms/database'` (xem `apps/api/src/prisma`).

## Lệnh

```bash
pnpm --filter @lms/database generate      # sinh client (không cần DB)
pnpm --filter @lms/database db:validate   # kiểm schema
pnpm --filter @lms/database migrate:dev   # tạo & áp migration (CẦN Postgres đang chạy)
pnpm --filter @lms/database studio        # mở Prisma Studio
```

Cần `DATABASE_URL` trong `.env` (root) — xem `.env.example`.
