# HANDOFF — P9: Production readiness (đưa LMS lên chạy thật)

> Prompt sẵn-để-dán cho session mới. Copy khối trong ``` vào session P9.
> Bối cảnh: P0–P8 ✅ xong — nghiệp vụ dạy–học chạy được đầu-cuối, UI đã re-skin toàn bộ.
> Cái còn thiếu KHÔNG phải tính năng mà là **hạ tầng vận hành**.

## Quyết định đã chốt (2026-08-19)

| Ngã rẽ | Chốt | Hệ quả |
|---|---|---|
| Storage | **Cloudinary** | Viết `CloudinaryStorageAdapter`. ⚠️ Phải dùng `resource_type: raw` + `type: authenticated` — xem cảnh báo §A |
| Chấm code | **Cần thật ngay** | Piston vào phase, KHÔNG hoãn. ⚠️ Nhưng không chạy được trên Render — xem §B |
| Deploy | **Render (API) + Vercel (web)** | ⚠️ Vỡ cookie refresh nếu để cross-origin — xem §C. Render free tier ngủ → treo job chấm, xem §D |
| Email | **Chưa có provider** | Quên-mật-khẩu hoãn sang T9.6. Pilot dùng admin đặt lại mật khẩu (T9.2) là đủ |

---

## ⚠️ Bốn cảnh báo phải xử lý, không được bỏ qua

### §A — Cloudinary với file PRIVATE

Toàn bộ mô hình bảo mật P7 dựa trên việc file **không** fetch được công khai: `GET /files/:id` stream qua API,
quyền kiểm ở `FilesService.ensureCanRead` (owner / `course.update` / thành viên lớp có gate ĐANG MỞ).
Cloudinary mặc định là CDN **công khai** — upload kiểu thường là ai có URL cũng tải được, phá invariant #5.

Bắt buộc khi làm T9.3:
- Upload với `resource_type: 'raw'` + `type: 'authenticated'` (hoặc `'private'`).
- **KHÔNG** trả `secure_url` của Cloudinary về client. Giữ nguyên luồng stream qua `GET /files/:id`;
  Cloudinary chỉ đóng vai blob store, `storageKey` vẫn do server sinh.
- Test phải khẳng định: URL Cloudinary thô (không chữ ký) → **không** tải được.

Ghi chú thẳng thắn: Cloudinary tối ưu cho ảnh/video công khai; PDF private hợp với R2/S3 hơn (và
`.env.example:21` vốn đã trỏ hướng R2). Đây là lựa chọn của chủ dự án — cứ làm, nhưng giữ đúng 3 ràng buộc trên.

### §B — Piston KHÔNG chạy được trên Render

Piston chấm code bằng sandbox cần quyền cao (isolate/cgroups, thường phải `--privileged` hoặc
Docker-in-Docker). **Render không cho chạy container privileged.** Nên `CODE_RUNNER_PROVIDER=piston` trỏ vào
một service Piston nằm *trong* Render là không khả thi.

Ba đường (session P9 phải chốt một, kiểm chứng trước khi code):
1. **VPS nhỏ riêng cho Piston** (Hetzner/DO ~5 USD/tháng, Docker chạy được privileged). API trên Render gọi
   sang qua HTTPS + token. **Khuyến nghị** — không phải viết code mới, `PistonRunnerAdapter` đã có sẵn.
2. **Judge0 hosted** (RapidAPI). Phải **viết adapter mới** — hiện `runner.module.ts:21` chỉ biết `piston` và
   `stub`, không có Judge0 adapter.
3. Piston public API (emkc.org) — rate limit, ToS không dành cho production. Chỉ hợp demo.

### §C — Render + Vercel làm VỠ cookie refresh nếu để nguyên

Hiện trạng: `apps/web/src/lib/queryClient.ts:13` đặt `API_BASE = '/api'` (đường dẫn tương đối), và refresh
token là cookie `httpOnly` + `sameSite: 'lax'`, path `/api/auth` (`auth.controller.ts:72`).
Web ở `*.vercel.app` gọi API ở `*.onrender.com` là **cross-site** → trình duyệt KHÔNG gửi cookie `sameSite=lax`
→ refresh chết, user bị đá ra đăng nhập lại sau 15 phút.

Ba đường:
1. **Vercel rewrite** `/api/:path*` → `https://<api>.onrender.com/api/:path*` trong `vercel.json`.
   Trình duyệt chỉ nói chuyện với origin Vercel → same-origin, `sameSite: lax` giữ nguyên, **không cần CORS**,
   và `API_BASE` khỏi phải sửa. **Khuyến nghị cho pilot.**
   ⚠️ Phải kiểm chứng giới hạn kích thước response khi proxy PDF bài học (tối đa 20MB) qua Vercel —
   nếu đụng trần thì rơi về đường 2.
2. **Custom domain cùng gốc**: `app.codespace.vn` (Vercel) + `api.codespace.vn` (Render), cookie đặt
   `Domain=.codespace.vn` → same-site thật, file lớn đi thẳng không qua proxy. Sạch nhất về lâu dài, cần domain.
3. Cross-site với `sameSite: 'none'; secure` + CORS credentials. Chạy được nhưng mở diện CSRF, phải bù
   biện pháp. **Chỉ dùng khi cả 1 và 2 đều không được.**

### §D — Render free tier ngủ ⇒ treo bài chấm

Worker BullMQ chạy **in-process** trong API (`bull-submission-queue.ts:21` ghi rõ "runs in-process for the MVP").
Render free tier spin-down sau ~15 phút không request: API ngủ ⇒ không ai tiêu thụ queue ⇒ bài nộp treo ở
`queued` cho tới khi có người gọi API đánh thức. Với lớp học thật là không chấp nhận được.

⇒ API service phải dùng gói trả phí (Starter), hoặc tách worker thành Background Worker riêng (Render có loại
service này) — lúc đó `bull-submission-queue.ts` cần tách phần Worker ra entrypoint riêng.

---

## Hiện trạng đã xác minh (đừng đi khảo sát lại)

| Hạng mục | Trạng thái |
|---|---|
| Artifact triển khai | ❌ Không có Dockerfile / CI / script deploy. `docker-compose.yml` **chỉ là Postgres+Redis cho DEV** (tự ghi rõ ở dòng 2). |
| Storage | ⚠️ Chỉ `LocalStorageAdapter` → `./uploads` (`local-storage.adapter.ts:11`). Chưa có dependency Cloudinary trong `apps/api/package.json`. |
| Code runner | ⚠️ Mặc định `stub` (`runner.module.ts:21`). `PistonRunnerAdapter` đã viết sẵn, queue Bull cũng có — thiếu hạ tầng chạy (§B). |
| Cấp tài khoản | ⚠️ Backend đủ: `POST /users` (`users.controller.ts:36`, DTO có `password` + `roleKeys`), `PATCH /users/:id`, `POST/DELETE /users/:id/roles`. **FE `AdminHome.tsx` CHỈ ĐỌC.** |
| Mật khẩu | ❌ Không có quên/đổi mật khẩu, không có email. |
| Rate limit / helmet | ❌ Không có (`main.ts` chỉ có cookieParser + ValidationPipe + CORS + prefix `api`). |
| Env validation | ❌ `ConfigModule.forRoot({ isGlobal: true })` không có `validate` → thiếu `JWT_ACCESS_SECRET` ở prod vẫn boot. |
| Cookie refresh | ✅ `httpOnly`, `secure` khi production, `sameSite: lax`, path hẹp `/api/auth`. Nhưng xem §C. |
| Health check | ✅ `GET /api/health`. |

---

```
Bạn tiếp nhận dự án CodeSpace LMS (monorepo pnpm: apps/api NestJS+Prisma, apps/web React+Vite+Tailwind
+TanStack Query+react-i18next). ĐỌC `AGENTS.md` ở root TRƯỚC rồi chạy Default Startup Sequence.
Giao tiếp tiếng Việt; code/identifier/commit tiếng Anh.

## VỊ TRÍ HIỆN TẠI
- **P0–P8 ✅ DONE** trên `main` local (ahead origin, CHƯA push). `pnpm validate` 16/16
  (api 195 test / 22 suite), i18n parity vi/en 473/473.
- Docker dev: Postgres :5433 / Redis :6380 — `docker start lms-postgres lms-redis`
  (KHÔNG `pnpm db:up` trong git worktree — trùng tên container).
- **ĐỌC `HANDOFF_P9.md` §A–§D TRƯỚC KHI CODE.** Bốn cảnh báo đó là thứ quyết định phase này
  thành hay bại: Cloudinary với file private, Piston không chạy được trên Render, cookie refresh
  vỡ khi Vercel↔Render cross-origin, và Render free tier ngủ làm treo queue chấm bài.

## NHIỆM VỤ: P9 — đưa hệ thống lên Render + Vercel, chạy thật được

### T9.0 — Khởi động an toàn (CHẶN mọi thứ sau)
- **Validate env fail-fast**: schema cho `ConfigModule` (`app.module.ts:26`) — bắt buộc `DATABASE_URL`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN` khi `NODE_ENV=production`; API phải CHẾT lúc boot
  nếu thiếu, không chạy tiếp với mặc định.
- **helmet** + **rate limit** (`@nestjs/throttler`): siết riêng `POST /auth/login` và `POST /auth/refresh`
  (gợi ý 5 lần / phút / IP). Render đứng sau proxy ⇒ `app.set('trust proxy', 1)`, không thì rate limit đếm
  nhầm IP và chặn oan cả lớp.
- Kiểm lại exception filter: production trả message chung, không stack trace (INVARIANT #7).
- Vá `.env.example`: THIẾU `CODE_RUNNER_PROVIDER`, `CODE_QUEUE_DRIVER`, `SEED_ADMIN_EMAIL/PASSWORD/NAME`,
  `STORAGE_DRIVER`; `DATABASE_URL`/`REDIS_URL` đang ghi cổng 5432/6379 trong khi compose map ra 5433/6380.
- Test: env schema thiếu biến → throw; throttler chặn sau N lần login sai.

### T9.1 — Quản trị người dùng trên UI (KHÔNG cần backend mới)
`AdminHome.tsx` hiện chỉ đọc. Dùng đúng endpoint đã có:
- Dialog **tạo user** (`POST /users`: email/password/fullName/status/roleKeys).
- **Sửa** trạng thái + họ tên (`PATCH /users/:id`); **gán/gỡ role** (`POST /users/:id/roles`,
  `DELETE /users/:id/roles/:roleKey`).
- Phân trang + tìm kiếm **server-side** (hiện fetch cứng `?page=1&pageSize=20` rồi lọc client — sai khi
  nhiều user).
- Tạo `features/users/hooks.ts` tử tế (hiện chỉ có `lookup.ts` + `useQuery` viết thẳng trong page).
- Mọi chuỗi qua `t()`, thêm CẢ vi lẫn en.

### T9.2 — Vòng đời mật khẩu
- `POST /auth/change-password` (self-service): bắt buộc kiểm mật khẩu cũ, revoke toàn bộ refresh token
  đang sống của user đó.
- `POST /users/:id/reset-password` (quyền `user.update`): AuditLog **cùng transaction** (INVARIANT #6),
  cũng revoke refresh token.
- FE: form đổi mật khẩu trong khu vực tài khoản + nút đặt lại ở AdminHome.
- Sau T9.2 là mở được cho người dùng thật trong phạm vi hẹp.

### T9.3 — Storage Cloudinary (đọc §A trước)
- `STORAGE_DRIVER=local|cloudinary` chọn adapter trong `storage.module.ts`; `local` vẫn mặc định ở dev.
- `CloudinaryStorageAdapter` khớp interface `StorageAdapter` hiện có, dùng cho CẢ file bài học lẫn PDF
  chứng chỉ. Upload `resource_type: 'raw'`, `type: 'authenticated'`.
- Giữ nguyên: `storageKey` server sinh, stream qua `GET /files/:id`, quyền vẫn ở `ensureCanRead`.
  **Không** trả URL Cloudinary về client.
- Test: adapter với client mock; giữ nguyên `files.service.spec.ts`; thêm khẳng định URL thô không tải được.

### T9.4 — Deploy Render + Vercel (đọc §C và §D trước)
- **Render**: API là Web Service (Docker hoặc native Node), + Render Postgres + Render Key Value (Redis).
  `prisma migrate deploy` ở bước release (KHÔNG `migrate dev`). Gói trả phí cho API vì §D.
- **Vercel**: web là static SPA. Thêm `vercel.json` với rewrite `/api/:path*` → API trên Render (§C đường 1),
  rồi **kiểm chứng thật** việc tải PDF 20MB qua rewrite.
- `WEB_ORIGIN` trỏ đúng domain Vercel; kiểm `secure` cookie hoạt động (Render/Vercel đều HTTPS).
- **CI GitHub Actions**: `pnpm validate` trên PR.
- Runbook trong `docs/`: biến môi trường bắt buộc, thứ tự khởi động, cách rollback.
- Smoke sau deploy: đăng nhập → chờ hết hạn access token → refresh phải TỰ ĐỘNG thành công (đây là bài test
  bắt được lỗi §C); mở PDF bài học; cấp chứng chỉ và tải PDF.

### T9.5 — Chấm code thật (đọc §B trước)
- Chốt một trong 3 đường ở §B (khuyến nghị: VPS nhỏ chạy Piston, API gọi sang qua HTTPS + token).
- Bật `CODE_RUNNER_PROVIDER=piston` + `CODE_QUEUE_DRIVER=bull`, trỏ `CODE_RUNNER_URL`/`CODE_RUNNER_TOKEN`.
- Siết mạng: Piston chỉ nhận request từ IP/token của API, không phơi ra internet trần.
- Smoke thật: nộp Python đúng / sai / timeout / lỗi cú pháp → điểm khớp trọng số; hidden test KHÔNG lộ ra client.

### T9.6 — Vận hành + email (sau khi đã sống được)
- Backup Postgres định kỳ + runbook restore đã kiểm chứng bằng một lần restore thật.
- Log ra stdout, mức log theo env.
- **Email**: chưa có provider. Gợi ý bắt đầu bằng **Resend** (free ~3.000 mail/tháng, tích hợp đơn giản nhất)
  hoặc SMTP sẵn có của công ty. Có provider rồi mới làm quên-mật-khẩu-qua-email; trước đó T9.2 đã đủ dùng.

### NỢ TỪ P8 (gom vào P9, đều nhỏ)
- `GET /teach/overview` (hoặc `/submissions/pending-count`): hero Giảng dạy đang dùng chip "Khóa học" thay
  cho "chờ chấm" như design §7, vì đếm toàn cục cần fan-out (lớp × bài tập). Endpoint gộp cũng thay được
  N request `/classes/:id/report` mà hero đang bắn.
- Hook FE còn thiếu: `useUpdateClass` ("Cài đặt lớp"), unassign khóa khỏi lớp, `useUpdateAssignment`
  ("Sửa bài tập"), `useUpdateCodingProblem` ("Sửa đề"). Rà endpoint backend trước.
- Dọn dữ liệu: bản ghi `File.fileName` lưu TRƯỚC bản vá mojibake vẫn hỏng dấu.
- Chưa smoke live tab **Trắc nghiệm** và **Sổ điểm & chứng chỉ**.

### RÀNG BUỘC BẤT BIẾN
- Giữ `pnpm validate` 16/16 sau MỖI lô. `prisma generate` EPERM khi API dev đang chạy → tắt API trước:
  `netstat -ano | grep :3000` → `taskkill //PID <pid> //F`.
- Không hardcode secret; `.env.example` chỉ giá trị giả.
- Không nới quyền: endpoint mới phải khai `@RequirePermission`, ownership kiểm ở service (INVARIANT #3).
- Đổi/đặt lại mật khẩu, gán role đều ghi AuditLog cùng transaction.
- File private vẫn phải private — §A là ràng buộc bảo mật, không phải gợi ý.
- Mọi chuỗi hiển thị qua `t()`, thêm cả vi lẫn en.
```

---

## Ước lượng

T9.0 + T9.1 + T9.2 là phần chặn thật sự, mỗi mục ~1 lô, không phụ thuộc hạ tầng ngoài — **làm được ngay**.
T9.3 cần tài khoản Cloudinary. T9.4 cần tài khoản Render + Vercel. T9.5 cần chốt §B (nhiều khả năng phải thuê
thêm 1 VPS nhỏ). T9.6 cần chốt email provider.
