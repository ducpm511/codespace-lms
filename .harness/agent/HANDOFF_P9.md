# HANDOFF — P9: Production readiness (đưa LMS lên chạy thật)

> Prompt sẵn-để-dán cho session mới. Copy khối trong ``` vào session P9.
> Bối cảnh: P0–P8 ✅ xong — nghiệp vụ dạy–học chạy được đầu-cuối, UI đã re-skin toàn bộ.
> Cái còn thiếu KHÔNG phải tính năng mà là **hạ tầng vận hành**: chưa có artifact triển khai nào,
> file lưu trên đĩa cục bộ, chấm code đang là stub, không có đường cấp/khôi phục tài khoản,
> thiếu lớp phòng thủ cơ bản (helmet, rate limit).

## ⚠️ Đọc trước khi bắt đầu

Đây là phase **hạ tầng + vá lỗ hổng vận hành**, không phải phase tính năng mới. Nguyên tắc:
- **Không đổi nghiệp vụ đang chạy.** Mọi thay đổi phải giữ `pnpm validate` 16/16 (hiện: api 195 test / 22 suite,
  i18n parity vi/en 473/473).
- **Không hardcode secret** (INVARIANT #1). Mọi giá trị mới đi qua env + `.env.example` giá trị giả.
- Thứ tự T9.0 → T9.4 là **thứ tự chặn**: làm đúng thứ tự thì sau T9.2 đã có thể mở cho người dùng thật
  trong mạng nội bộ, sau T9.4 mới mở ra internet.

## Hiện trạng đã xác minh (đừng đi khảo sát lại)

| Hạng mục | Trạng thái |
|---|---|
| Artifact triển khai | ❌ Không có Dockerfile / CI / script deploy. `docker-compose.yml` **chỉ là Postgres+Redis cho DEV** (tự ghi rõ ở dòng 2), mật khẩu dev, không có service app. |
| Storage | ⚠️ Chỉ `LocalStorageAdapter` → `./uploads` (`apps/api/src/common/storage/local-storage.adapter.ts:11`). `.env.example:21` khai R2/Cloudinary nhưng **chưa có adapter nào**. |
| Code runner | ⚠️ Mặc định `stub` (`apps/api/src/coding/runner/runner.module.ts:21`). Adapter Piston đã viết sẵn (`piston-runner.adapter.ts`), queue Bull cũng có (`bull-submission-queue.ts`) — chỉ thiếu hạ tầng chạy. |
| Cấp tài khoản | ⚠️ Backend đủ: `POST /users` (`users.controller.ts:36`, DTO có `password` + `roleKeys`), `PATCH /users/:id`, `POST/DELETE /users/:id/roles`. **FE `AdminHome.tsx` chỉ ĐỌC** — list 20 user đầu + audit, không tạo/sửa/gán role. |
| Mật khẩu | ❌ Không có quên/đổi mật khẩu, không có email (grep `apps/api/src` → 0 kết quả cho forgot/reset/nodemailer). Mất mật khẩu = không có đường lấy lại trong app. |
| Rate limit / helmet | ❌ Không có (`apps/api/src/main.ts` chỉ có cookieParser + ValidationPipe + CORS + prefix `api`). |
| Env validation | ❌ `ConfigModule.forRoot({ isGlobal: true })` không có `validate` → thiếu `JWT_ACCESS_SECRET` ở prod vẫn boot rồi hỏng lúc chạy. |
| Cookie refresh | ✅ Đã đúng: `httpOnly`, `secure` khi `NODE_ENV=production`, `sameSite: lax`, path hẹp `/api/auth`. |
| Health check | ✅ `GET /api/health` có sẵn. |

---

```
Bạn tiếp nhận dự án CodeSpace LMS (monorepo pnpm: apps/api NestJS+Prisma, apps/web React+Vite+Tailwind
+TanStack Query+react-i18next). ĐỌC `AGENTS.md` ở root TRƯỚC rồi chạy Default Startup Sequence.
Giao tiếp tiếng Việt; code/identifier/commit tiếng Anh.

## VỊ TRÍ HIỆN TẠI
- **P0–P8 ✅ DONE** trên `main` local (HEAD `6101520`, ahead origin 7, CHƯA push).
  `pnpm validate` 16/16 (api 195 test / 22 suite), i18n parity vi/en 473/473.
- Docker Postgres :5433 / Redis :6380 — container đã tồn tại, dùng `docker start lms-postgres lms-redis`
  (KHÔNG `pnpm db:up` nếu đang ở git worktree — trùng tên container).
- Chi tiết hiện trạng hạ tầng: bảng "Hiện trạng đã xác minh" trong `HANDOFF_P9.md`.

## NHIỆM VỤ: P9 — đưa hệ thống lên trạng thái deploy được

### T9.0 — Khởi động an toàn (CHẶN mọi thứ sau)
- **Validate env fail-fast**: schema cho `ConfigModule` (`app.module.ts:26`) — bắt buộc `DATABASE_URL`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN` khi `NODE_ENV=production`; API phải CHẾT lúc boot
  nếu thiếu, không chạy tiếp với giá trị mặc định.
- **helmet** + **rate limit** (`@nestjs/throttler`): siết riêng `POST /auth/login` và `POST /auth/refresh`
  (gợi ý 5 lần / phút / IP), mặc định lỏng hơn cho phần còn lại. Nhớ `app.set('trust proxy', 1)` nếu đứng sau
  reverse proxy, không thì rate limit đếm nhầm IP.
- **Không lộ nội bộ**: kiểm lại exception filter — production trả message chung, không stack trace (INVARIANT #7).
- Cập nhật `.env.example` cho khớp thực tế: hiện THIẾU `CODE_RUNNER_PROVIDER`, `CODE_QUEUE_DRIVER`,
  `SEED_ADMIN_EMAIL/PASSWORD/NAME`, `STORAGE_DRIVER`; và `DATABASE_URL`/`REDIS_URL` đang ghi cổng 5432/6379
  trong khi compose map ra 5433/6380.
- Test: unit cho env schema (thiếu biến → throw), e2e/unit cho throttler trên login.

### T9.1 — Quản trị người dùng trên UI (KHÔNG cần backend mới)
`AdminHome.tsx` hiện chỉ đọc. Bổ sung, dùng đúng endpoint đã có:
- Form **tạo user** (`POST /users` — email/password/fullName/status/roleKeys) trong dialog Nocturne.
- **Sửa** trạng thái + họ tên (`PATCH /users/:id`), **gán/gỡ role** (`POST /users/:id/roles`,
  `DELETE /users/:id/roles/:roleKey`).
- Phân trang + tìm kiếm **server-side** (hiện đang fetch cứng `?page=1&pageSize=20` rồi lọc client — sai khi
  nhiều user).
- Tạo `features/users/hooks.ts` cho tử tế (hiện chỉ có `lookup.ts` + `useQuery` viết thẳng trong page).
- Mọi chuỗi qua `t()`, thêm CẢ vi lẫn en (parity phải sạch).

### T9.2 — Vòng đời mật khẩu
- **Đổi mật khẩu** (self-service): `POST /auth/change-password` — bắt buộc kiểm mật khẩu cũ, revoke toàn bộ
  refresh token đang sống của user đó sau khi đổi.
- **Admin đặt lại mật khẩu**: `POST /users/:id/reset-password` (quyền `user.update`), ghi AuditLog **cùng
  transaction** (INVARIANT #6), cũng revoke refresh token.
- FE: form đổi mật khẩu trong khu vực tài khoản + nút đặt lại ở AdminHome.
- Quên-mật-khẩu-qua-email KHÔNG làm ở đây (cần email provider) → xem T9.6.

### T9.3 — Storage bền
- `STORAGE_DRIVER=local|s3` chọn adapter trong `storage.module.ts`; `local` vẫn là mặc định dev.
- Viết `S3StorageAdapter` (S3-compatible, chạy được với Cloudflare R2 — dùng `@aws-sdk/client-s3`), khớp
  đúng interface `StorageAdapter` hiện có; áp cho CẢ file bài học lẫn PDF chứng chỉ.
- Giữ nguyên invariant: `storageKey` do server sinh, file private, quyền đọc vẫn qua `FilesService.ensureCanRead`
  — KHÔNG chuyển sang URL public.
- Test: unit adapter với S3 client mock; giữ nguyên bộ test `files.service.spec.ts`.

### T9.4 — Đóng gói & triển khai
- **Dockerfile multi-stage** cho api (node slim, `prisma generate` lúc build, chạy `node dist/main.js`) và cho
  web (build Vite → nginx serve static + proxy `/api`).
- **`docker-compose.prod.yml`**: postgres + redis + api + web, healthcheck, `restart: unless-stopped`, volume
  bền cho Postgres và cho `uploads/` (nếu chưa dùng S3).
- Migrate lúc deploy bằng `prisma migrate deploy` (KHÔNG `migrate dev` trên prod).
- **CI GitHub Actions**: chạy `pnpm validate` trên PR; build image trên tag.
- Runbook ngắn trong `docs/`: biến môi trường bắt buộc, thứ tự khởi động, cách rollback.

### T9.5 — Chấm code thật (tách được nếu pilot chưa cần)
- Thêm service Piston self-host vào compose prod; bật `CODE_RUNNER_PROVIDER=piston` + `CODE_QUEUE_DRIVER=bull`.
- Smoke thật: nộp bài Python đúng/sai/timeout/lỗi biên dịch → điểm khớp trọng số, hidden test KHÔNG lộ ra client.
- Nếu bỏ qua phase này: phải ẩn/khóa tính năng bài lập trình khỏi pilot, đừng để học viên nộp vào stub.

### T9.6 — Vận hành (làm sau khi đã sống được)
- Backup Postgres định kỳ + runbook restore (đã kiểm chứng bằng một lần restore thật).
- Log ra stdout, mức log theo env; cân nhắc request-id.
- Quên mật khẩu qua email (cần chốt provider SMTP/Resend/SES trước).

### NỢ TỪ P8 (gom vào P9, đều nhỏ)
- `GET /teach/overview` (hoặc `GET /submissions/pending-count`): hero Giảng dạy hiện dùng chip "Khóa học" thay
  cho "chờ chấm" như design §7 vì đếm chờ chấm toàn cục cần fan-out (lớp × bài tập). Endpoint tổng hợp này
  cũng thay được N request `/classes/:id/report` mà hero đang bắn.
- Hook FE còn thiếu cho nút design §7 mô tả: `useUpdateClass` ("Cài đặt lớp"), unassign khóa khỏi lớp,
  `useUpdateAssignment` ("Sửa bài tập"), `useUpdateCodingProblem` ("Sửa đề"). Rà endpoint backend trước.
- Dọn dữ liệu: các bản ghi `File.fileName` lưu TRƯỚC bản vá mojibake (`6101520`) vẫn hỏng dấu.
- Chưa smoke live tab **Trắc nghiệm** và **Sổ điểm & chứng chỉ** (đã pass typecheck/lint/build/validate).

### RÀNG BUỘC BẤT BIẾN
- Giữ `pnpm validate` 16/16 sau MỖI lô. `prisma generate` EPERM khi API dev đang chạy → tắt API trước:
  `netstat -ano | grep :3000` → `taskkill //PID <pid> //F`.
- Không hardcode secret; `.env.example` chỉ giá trị giả.
- Không nới quyền: mọi endpoint mới phải khai `@RequirePermission`, ownership kiểm ở service (INVARIANT #3).
- Thao tác đổi mật khẩu / đặt lại mật khẩu / gán role đều phải ghi AuditLog cùng transaction.
- Mọi chuỗi hiển thị qua `t()`, thêm cả vi lẫn en.
```

---

## Ghi chú cho người quyết

Bốn ngã rẽ dưới đây đổi phạm vi T9.3–T9.5 khá nhiều — nên chốt trước khi mở session P9:

1. **Storage**: gắn volume bền cho `uploads/` (rẻ, 1 VM, không viết code) **hay** viết `S3StorageAdapter` cho R2
   (chạy được nhiều instance, tốn ~1 lô)? Giả định mặc định của plan: **viết adapter**, vì `.env.example` đã
   trỏ hướng R2 từ đầu.
2. **Chấm code trong pilot**: cần thật ngay (T9.5 vào phase) hay tạm ẩn tính năng bài lập trình?
3. **Đích deploy**: 1 VM tự quản (compose) hay platform (Fly/Render/Coolify)? Plan đang giả định **1 VM + compose**.
4. **Email**: đã có provider chưa? Chưa có thì T9.6 quên-mật-khẩu phải hoãn, và T9.2 (admin đặt lại tay) là
   đường duy nhất — đủ cho pilot.

**Ước lượng thô**: T9.0 + T9.1 + T9.2 là phần chặn thật sự, mỗi mục ~1 lô. T9.4 nặng nhất vì phải chạy thử
end-to-end. T9.3 và T9.5 phụ thuộc câu trả lời ở trên.
