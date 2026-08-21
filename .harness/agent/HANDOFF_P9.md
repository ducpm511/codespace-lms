# HANDOFF — P9: Production readiness (1 VPS 2 GB, cấu hình lean)

> ✅ **P9 ĐÃ XONG (2026-08-21).** File này giữ lại làm hồ sơ quyết định — §A (Cloudinary private) và
> §B (cách ly Piston) vẫn là ràng buộc còn hiệu lực. Trạng thái hiện tại và việc còn lại:
> `CURRENT_STATE.md` + `ACTIVE_TASKS.md`. Quy trình vận hành: `docs/RUNBOOK.md`.

> Prompt sẵn-để-dán cho session mới. Copy khối trong ``` vào session P9.
> Bối cảnh: P0–P8 ✅ xong — nghiệp vụ dạy–học chạy được đầu-cuối, UI đã re-skin toàn bộ.
> Cái còn thiếu KHÔNG phải tính năng mà là **hạ tầng vận hành**.

## Quyết định đã chốt (2026-08-19)

| Ngã rẽ | Chốt |
|---|---|
| Đích deploy | **1 VPS duy nhất**: 2 vCPU / **2 GB RAM** / 30 GB NVMe (~164k đ/tháng). Chạy tất cả: Caddy + API + Postgres + Piston |
| Chấm code | **Thật ngay** — Piston self-host trên chính VPS đó |
| Storage | **Cloudinary** (đọc §A) — cũng giúp giữ 30 GB đĩa không bị PDF ăn hết |
| Editor | **Giữ Monaco** (không thay CodeMirror) → phải bù bằng cache tĩnh, xem T9.4 |
| Email | Chưa có provider → quên-mật-khẩu hoãn sang T9.6; pilot dùng admin đặt lại mật khẩu (T9.2) |

**Ngân sách chi phí**: ~6.3 USD/tháng — **rẻ hơn Frappe 9 USD hiện tại**. Đây là ràng buộc thiết kế của cả
phase: mọi lựa chọn kỹ thuật phải vừa 2 GB RAM.

Quyết định "1 VPS" đã **xoá 3 cảnh báo** của bản plan trước: Piston chạy được (VPS cho phép container
privileged); Caddy vừa serve web vừa proxy `/api` nên cùng origin, cookie `sameSite: lax` nguyên vẹn, khỏi CORS;
không có spin-down nên worker không chết. Chỉ còn **§A** và thêm **§B** mới.

---

## §A — Cloudinary với file PRIVATE (ràng buộc bảo mật, không phải gợi ý)

Mô hình bảo mật P7 dựa trên việc file **không** fetch được công khai: `GET /files/:id` stream qua API, quyền
kiểm ở `FilesService.ensureCanRead` (owner / `course.update` / thành viên lớp có gate ĐANG MỞ). Cloudinary mặc
định là CDN **công khai** — upload kiểu thường thì ai có URL cũng tải được, phá INVARIANT #5.

Bắt buộc khi làm T9.3:
- Upload `resource_type: 'raw'` + `type: 'authenticated'` (hoặc `'private'`).
- **KHÔNG** trả `secure_url` của Cloudinary về client. Giữ nguyên stream qua `GET /files/:id`; Cloudinary chỉ
  là blob store, `storageKey` vẫn do server sinh.
- Test phải khẳng định: URL Cloudinary thô (không chữ ký) → **không** tải được.

## §B — Piston nằm cùng máy với Postgres ⇒ phải cách ly mạng

Piston chạy mã tùy ý do học viên gửi lên. Trên VPS này nó ở **cùng host với database**. Sandbox của Piston sinh
ra để chịu đúng tình huống này, nhưng một lần thoát container là mất sạch dữ liệu. Bắt buộc:
- Hai docker network tách biệt: `lms-data` (api ↔ postgres) và `lms-runner` (api ↔ piston).
  **Piston KHÔNG được nằm cùng network với postgres.**
- Piston không map port ra host (`0.0.0.0`), không có egress internet.
- Giới hạn container: `--memory=192m`, concurrency **1**.

⚠️ Nếu vì lý do gì phải cắt Piston: **tắt hẳn tính năng bài lập trình** trong pilot. TUYỆT ĐỐI không chạy code
học viên bằng subprocess trần trên VPS để tiết kiệm RAM — đó là đọc được cả database.

---

## Ngân sách RAM (ràng buộc cứng của phase)

Đo trên artifact thật của dự án: `apps/web/dist` **47 MB** (monaco 24 MB, pyodide 13 MB, assets 8.4 MB,
brand 1.6 MB), `apps/api/dist` 733 KB, bundle chính 596 KB raw / ~200 KB gzip.

| Tiến trình | Mặc định | Mục tiêu | Cách đạt |
|---|---|---|---|
| Redis | 128–256 MB | **0** | Bỏ hẳn — `CODE_QUEUE_DRIVER=inline` |
| Postgres | 0.5–1 GB | 300–400 MB | `shared_buffers=128MB`, `max_connections=20` |
| API Node | 300–500 MB | 250–350 MB | `--max-old-space-size=384`, `NODE_ENV=production` |
| Piston | — | 150 MB idle / 300 MB đỉnh | concurrency 1, `--memory=192m` |
| Caddy | 50 MB | 30 MB | |
| OS + swap | 300 MB | 250 MB | swap 2 GB |
| **Tổng** | ~2.1 GB | **~1.1 GB thường / ~1.4 GB đỉnh** | dư ~600 MB đệm |

---

## Hiện trạng đã xác minh (đừng đi khảo sát lại)

| Hạng mục | Trạng thái |
|---|---|
| Artifact triển khai | ❌ Không có Dockerfile / CI / script deploy. `docker-compose.yml` chỉ là Postgres+Redis cho DEV. |
| Storage | ⚠️ Chỉ `LocalStorageAdapter` → `./uploads` (`local-storage.adapter.ts:11`). Chưa có dependency Cloudinary. |
| Code runner | ⚠️ Mặc định `stub` (`runner.module.ts:21`); `PistonRunnerAdapter` đã viết sẵn — chỉ thiếu hạ tầng chạy. |
| **Redis** | ✅ **Chỉ dùng cho queue chấm bài** — grep `apps/api/src` xác nhận không có session/cache nào dùng Redis ⇒ bỏ được sạch. |
| **Inline queue** | ✅ `InlineSubmissionQueue` đã có từ P3. `await` autograder, mà autograder gọi Piston qua **HTTP** ⇒ I/O bất đồng bộ, **event loop KHÔNG bị chặn**; chỉ request nộp bài đó chờ lâu hơn. Mất retry tự động của BullMQ — chấp nhận được cho pilot. |
| Cấp tài khoản | ⚠️ Backend đủ (`users.controller.ts:36` + PATCH + gán/gỡ role). **FE `AdminHome.tsx` CHỈ ĐỌC.** |
| Mật khẩu | ❌ Không có quên/đổi mật khẩu, không có email. |
| Rate limit / helmet | ❌ Không có (`main.ts`). |
| Env validation | ❌ `ConfigModule.forRoot({ isGlobal: true })` không có `validate`. |
| Cookie refresh | ✅ `httpOnly`, `secure` khi production, `sameSite: lax`, path `/api/auth`. Cùng origin qua Caddy ⇒ chạy đúng. |
| FE gọi API | ✅ `API_BASE = '/api'` tương đối (`queryClient.ts:13`) ⇒ Caddy proxy là khớp, không phải sửa code. |
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
- **ĐỌC `HANDOFF_P9.md` §A, §B và bảng "Ngân sách RAM" TRƯỚC KHI CODE.**

## RÀNG BUỘC BAO TRÙM CẢ PHASE
Đích chạy là **một VPS 2 vCPU / 2 GB RAM / 30 GB đĩa**, tổng ~6.3 USD/tháng (phải rẻ hơn Frappe 9 USD
mà đội đang dùng). Mọi lựa chọn kỹ thuật phải vừa ngân sách RAM ở bảng trên. Không thêm service thường
trú nào nếu chưa đo được nó tốn bao nhiêu.

## NHIỆM VỤ: P9 — đưa hệ thống lên 1 VPS, chạy thật được

### T9.0 — Khởi động an toàn (CHẶN mọi thứ sau)
- **Validate env fail-fast**: schema cho `ConfigModule` (`app.module.ts:26`) — bắt buộc `DATABASE_URL`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN` khi `NODE_ENV=production`; API phải CHẾT lúc boot
  nếu thiếu.
- **helmet** + **rate limit** (`@nestjs/throttler`) siết riêng `POST /auth/login` và `POST /auth/refresh`
  (gợi ý 5 lần / phút / IP). API đứng sau Caddy ⇒ `app.set('trust proxy', 1)`, không thì rate limit đếm
  nhầm IP và chặn oan cả lớp.
- Exception filter: production trả message chung, không stack trace (INVARIANT #7).
- Vá `.env.example`: THIẾU `CODE_RUNNER_PROVIDER`, `CODE_QUEUE_DRIVER`, `SEED_ADMIN_EMAIL/PASSWORD/NAME`,
  `STORAGE_DRIVER`, `CLOUDINARY_*` đã có nhưng chưa dùng; `DATABASE_URL`/`REDIS_URL` ghi cổng 5432/6379
  trong khi compose map 5433/6380.
- Test: env schema thiếu biến → throw; throttler chặn sau N lần login sai.

### T9.1 — Quản trị người dùng trên UI (KHÔNG cần backend mới)
`AdminHome.tsx` hiện chỉ đọc. Dùng đúng endpoint đã có:
- Dialog **tạo user** (`POST /users`: email/password/fullName/status/roleKeys).
- **Sửa** trạng thái + họ tên (`PATCH /users/:id`); **gán/gỡ role** (`POST /users/:id/roles`,
  `DELETE /users/:id/roles/:roleKey`).
- Phân trang + tìm kiếm **server-side** (hiện fetch cứng `?page=1&pageSize=20` rồi lọc client).
- Tạo `features/users/hooks.ts` tử tế (hiện chỉ có `lookup.ts` + `useQuery` viết thẳng trong page).
- Mọi chuỗi qua `t()`, thêm CẢ vi lẫn en.

### T9.2 — Vòng đời mật khẩu
- `POST /auth/change-password` (self-service): kiểm mật khẩu cũ, revoke toàn bộ refresh token của user đó.
- `POST /users/:id/reset-password` (quyền `user.update`): AuditLog **cùng transaction** (INVARIANT #6),
  cũng revoke refresh token.
- FE: form đổi mật khẩu ở khu vực tài khoản + nút đặt lại ở AdminHome.

### T9.3 — Storage Cloudinary (ĐỌC §A TRƯỚC)
- `STORAGE_DRIVER=local|cloudinary` chọn adapter trong `storage.module.ts`; `local` vẫn mặc định ở dev.
- `CloudinaryStorageAdapter` khớp interface `StorageAdapter` hiện có, dùng cho CẢ file bài học lẫn PDF chứng chỉ.
  Upload `resource_type: 'raw'`, `type: 'authenticated'`.
- Giữ nguyên: `storageKey` server sinh, stream qua `GET /files/:id`, quyền vẫn ở `ensureCanRead`.
- Test: adapter với client mock; giữ `files.service.spec.ts`; thêm khẳng định URL thô không tải được.

### T9.4 — Cấu hình lean cho 2 GB (đây là phần "tối ưu trong code")
- **Bỏ Redis**: `CODE_QUEUE_DRIVER=inline`. Kiểm chứng lại rằng không còn chỗ nào cần `REDIS_URL`; gỡ Redis
  khỏi compose prod (GIỮ trong compose dev để còn test đường bull). Ghi rõ trong runbook: mất retry tự động,
  chấm lỗi thì học viên nộp lại.
- **Gộp query nợ từ P8**: thêm `GET /teach/overview` trả một lượt {số lớp, số học viên, số khóa, tiến độ TB,
  số bài chờ chấm}. Hiện hero Giảng dạy bắn **N request `/classes/:id/report`** mỗi lần mở tab (10 lớp = 10
  truy vấn tổng hợp). Gộp lại vừa giảm tải Postgres vừa trả được chip "chờ chấm" đúng design §7.
- **Node**: `--max-old-space-size=384`, `NODE_ENV=production`.
- **Postgres**: `shared_buffers=128MB`, `max_connections=20`, `work_mem` nhỏ.
- **Cache tĩnh** (quan trọng vì GIỮ Monaco): Caddy bật brotli/gzip + `Cache-Control: immutable, max-age=31536000`
  cho `/monaco/*`, `/pyodide/*`, `/assets/*` (tên file có hash nên an toàn). Lần đầu một học viên mở bài lập
  trình phải kéo ~37 MB; một lớp 30 em ≈ 1.1 GB nếu không cache. Đo lại bằng DevTools sau khi deploy.
- Sau lô này phải **đo thật** trên VPS: `docker stats` lúc nhàn rỗi và lúc 5 học viên nộp bài cùng lúc, ghi số
  vào runbook.

### T9.5 — Deploy 1 VPS (ĐỌC §B TRƯỚC)
- Ubuntu 24.04 LTS, swap 2 GB, `unattended-upgrades`, ufw chỉ mở 22/80/443, fail2ban, SSH chỉ dùng key.
- `docker-compose.prod.yml`: caddy + api + postgres + piston. **Hai network tách biệt** theo §B.
  Postgres và Piston **không** map port ra host.
- **Caddy** vừa serve `apps/web/dist` vừa `reverse_proxy /api/* api:3000` → cùng origin, TLS tự động.
- Dockerfile multi-stage cho api (`prisma generate` lúc build, chạy `node dist/main.js`); web build ra static
  cho Caddy mount.
- `prisma migrate deploy` ở bước release (KHÔNG `migrate dev`).
- CI GitHub Actions: `pnpm validate` trên PR.
- **Smoke sau deploy**: đăng nhập → chờ access token hết hạn → refresh phải TỰ ĐỘNG thành công; mở PDF bài học;
  nộp bài lập trình và nhận điểm thật; cấp chứng chỉ và tải PDF.

### T9.6 — Vận hành + email
- **Backup**: `pg_dump` cron **hằng ngày** đẩy ra ngoài máy. Backup hàng tuần của nhà cung cấp KHÔNG thay được
  (mất tối đa 7 ngày dữ liệu, và snapshot ổ đĩa của Postgres đang chạy không đảm bảo nhất quán).
  **Phải thử restore một lần** — backup chưa restore thử coi như chưa có.
- Log ra stdout, mức log theo env; xoay log để không ăn hết 30 GB.
- Email: chưa có provider. Gợi ý **Resend** (free ~3.000 mail/tháng) hoặc SMTP sẵn có của công ty. Có rồi mới
  làm quên-mật-khẩu; trước đó T9.2 đã đủ.

### NỢ TỪ P8
- `GET /teach/overview` → đã đưa vào T9.4.
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
- File private vẫn phải private (§A). Piston phải cách ly network khỏi Postgres (§B).
- Mọi chuỗi hiển thị qua `t()`, thêm cả vi lẫn en.
```

---

## Ước lượng

T9.0 + T9.1 + T9.2 + T9.4 **làm được ngay**, không chờ tài khoản dịch vụ nào. T9.3 cần tài khoản Cloudinary.
T9.5 cần VPS đã mua. T9.6 cần chốt email provider (có thể hoãn).
