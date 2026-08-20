# Active Tasks

<!-- SIZE LIMIT: 200 lines. Do not exceed. -->
<!-- Completed task history -> docs/archive/completed_tasks/ -->

Updated: 2026-08-19

## Quy ước đặt tên

- **P<n>** = **Phase** (giai đoạn lớn): P0...P6, xem Roadmap.
- **T<n>.<k>** = **Task** con của phase P<n>; số sau `T` luôn khớp số phase.

## Roadmap (theo docs/DESIGN.md §10)

| Phase | Nội dung | Trạng thái |
|---|---|---|
| **P0** Scaffold & nền auth/RBAC | monorepo, prisma, auth, PBAC | ✅ Done |
| **P1** Course & Class | course/section/lesson, class, gate, progress | ✅ Done |
| **P2** Assessments | assignment + submission + chấm tay | ✅ Done |
| **P3** Coding & Runner | Pyodide FE + Judge0/Piston + autograde | ✅ Done |
| **P4** Quiz | quiz engine + autograde | ✅ Done |
| **P5** Gradebook & Certificate | tổng hợp điểm, cấp + verify chứng chỉ | ✅ Done (T5.0–T5.7 + review fixes) |
| **P6** Polish & Gamification | notification, audit UI, báo cáo lớp, gamification thật, PDF cert, tech debt cleanup | ✅ Done (T6.1–T6.6 + D1–D5) |
| **P7** Lesson Activities | bài học đa hoạt động: markdown/pdf slide/video/quiz/coding/assignment | ✅ Done (T7.0–T7.6) |
| **P8** Teach redesign | áp design mới (README §7) cho 6 tab Giảng dạy + builder + sổ điểm | ✅ Done (T8.0–T8.5) |
| **P9** Production readiness | env fail-fast + helmet/rate-limit, quản trị user trên UI, vòng đời mật khẩu, storage bền, đóng gói & deploy | ⬅️ Next (chi tiết `HANDOFF_P9.md`) |

Phụ thuộc chung: `contracts -> prisma schema -> backend -> frontend`.

Ngoài roadmap: **Playful redesign FE** (apps/web) ✅ Done — re-skin gamified toàn app trên nền Nocturne
(chi tiết `CURRENT_STATE.md §Playful/gamified redesign`).

---

## Active Phase

### Phase P9: Production readiness — ⬅️ TIẾP THEO

Nghiệp vụ đã đủ cho pilot; cái chặn deploy là **hạ tầng vận hành**, không phải tính năng.
Kế hoạch đầy đủ + hiện trạng đã xác minh: `HANDOFF_P9.md`.

- **T9.0** Khởi động an toàn: validate env fail-fast ở prod, `helmet`, rate limit `/auth/login` + `/auth/refresh`,
  vá `.env.example` (thiếu `CODE_RUNNER_PROVIDER`/`CODE_QUEUE_DRIVER`/`SEED_ADMIN_*`/`STORAGE_DRIVER`, cổng DB/Redis sai).
- **T9.1** Quản trị user trên UI — `AdminHome` hiện CHỈ ĐỌC; backend `POST /users`, `PATCH /users/:id`,
  `POST/DELETE /users/:id/roles` đã có sẵn, chỉ thiếu FE + phân trang server-side.
- **T9.2** Vòng đời mật khẩu: đổi mật khẩu (self-service) + admin đặt lại, revoke refresh token, AuditLog cùng transaction.
- **T9.3** Storage **Cloudinary** — `STORAGE_DRIVER=local|cloudinary`, upload `resource_type: raw` +
  `type: authenticated`, KHÔNG trả URL Cloudinary về client (giữ guard `ensureCanRead`).
- **T9.4** **Cấu hình lean cho 2 GB** (phần tối ưu trong code): bỏ Redis (`CODE_QUEUE_DRIVER=inline` — Redis
  chỉ phục vụ queue chấm bài, đã xác minh), gộp `GET /teach/overview` thay N request `/classes/:id/report`,
  Node `--max-old-space-size=384`, Postgres `shared_buffers=128MB`, cache tĩnh brotli + immutable cho
  `/monaco/*` `/pyodide/*` (giữ Monaco nên phải bù bằng cache).
- **T9.5** Deploy **1 VPS** (2 vCPU / 2 GB / 30 GB): compose caddy + api + postgres + piston, Caddy vừa serve
  static vừa proxy `/api` (cùng origin), 2 docker network tách Piston khỏi Postgres, ufw/fail2ban.
- **T9.6** Vận hành: `pg_dump` hằng ngày + thử restore, xoay log; email khi có provider (gợi ý Resend).

**Đã chốt (2026-08-19)**: 1 VPS 2 GB (~6.3 USD/tháng, **rẻ hơn Frappe 9 USD đang dùng**) · chấm code thật
bằng Piston self-host · Cloudinary · **giữ Monaco** · chưa có email provider.

**Ngân sách RAM là ràng buộc cứng**: mục tiêu ~1.1 GB lúc thường / ~1.4 GB đỉnh (bảng chi tiết trong
`HANDOFF_P9.md`). Không thêm service thường trú nào nếu chưa đo được nó tốn bao nhiêu.

**⚠️ Hai cảnh báo còn lại — chi tiết `HANDOFF_P9.md` §A–§B:**
- §A Cloudinary mặc định là CDN công khai → phải `type: authenticated`, không thì vỡ INVARIANT #5.
- §B Piston chạy mã học viên **cùng host với Postgres** → bắt buộc tách docker network, không map port ra
  host, `--memory=192m`, concurrency 1. Nếu phải cắt Piston thì TẮT HẲN tính năng bài lập trình, tuyệt đối
  không chạy code bằng subprocess trần.

Quyết định "1 VPS" đã xoá 3 cảnh báo của bản plan Render+Vercel: Piston chạy được, cookie refresh cùng origin
nên không vỡ, và không còn spin-down làm treo queue.

---

### Phase P8: Teach redesign — ✅ HOÀN THÀNH (2026-08-19)

Khu vực Giảng dạy đã áp ngữ pháp layout của design handoff §7 (sidebar 308px + cột detail), khớp với
Learn / Admin / Login đã playful từ trước. Chi tiết `CURRENT_STATE.md §P8`.

- **T8.0** `TeachHome` teacher hero (số liệu thật từ `useClasses`/`useCourses`/`/classes/:id/report`) +
  `.seg` 6 tab; bổ sung `.seg-btn`/`.seg-active` còn thiếu trong `nocturne.css`.
- **T8.1** `teachUi.tsx` (bộ layout dùng chung) + `TeachCourses` §7a + `LessonActivityBuilder` §7f.
- **T8.2** `TeachClasses` §7b (card lớp có progress, sub-tab Quản lý/Báo cáo, gate theo chương).
- **T8.3** `TeachAssignments` §7c + `TeachCoding` §7d.
- **T8.4** `TeachQuiz` §7e + `TeachGradebook` §7g (port khỏi `slate-*` thô).
- **T8.5** `pnpm validate` 16/16 (api 183 test / 21 suite), i18n parity vi/en **473/473**.

**Nợ nhỏ phát sinh — cần backend, KHÔNG làm trong task styling:**
- `GET /submissions/pending-count` (hoặc `GET /teach/overview`) để hero hiện được "còn N bài chờ chấm"
  như §7 mô tả. Hiện chip thứ 3 dùng "Khóa học" vì đếm chờ chấm toàn cục cần fan-out (lớp × bài tập).
  Endpoint tổng hợp này cũng thay được N request `/classes/:id/report` mà hero đang gọi.
- Thiếu hook FE cho các nút §7 mô tả: `useUpdateClass` ("Cài đặt lớp"), unassign khóa khỏi lớp,
  `useUpdateAssignment` ("Sửa bài tập"), `useUpdateCodingProblem` ("Sửa đề"). Endpoint backend có thể đã
  có — cần rà trước khi thêm hook.
- **Tên file PDF upload bị mojibake** (`BÃ i 10...pdf`): `File.fileName` lưu từ `file.originalname` của
  multer (latin1). Sửa ở `apps/api` (decode `Buffer.from(name,'latin1').toString('utf8')`) — ngoài scope P8.

---

### Phase P7: Lesson Activities — ✅ HOÀN THÀNH (2026-08-19)

Bài học = **container activity có thứ tự** (markdown/pdf/video/quiz/coding/assignment). T7.0 contracts ·
T7.1 migration `p7_lesson_activities` (+ backfill) · T7.2 module `files` (PDF: allowlist mime + magic bytes
+ 20MB, storageKey server sinh, guard owner/`course.update`/member lớp có gate mở) · T7.3
`lesson-activities.service` (CRUD + reorder 2 pha, IDOR course→section→lesson) · T7.4 `LessonActivityBuilder`
· T7.5 render activity trong `LessonDetail` · bonus `GET /assignments/for-class/:classId`.
INVARIANT verify (live): XSS markdown render thành TEXT; video ngoài allowlist → 400; upload PNG / PDF giả
mime → 400; trước gate `my-lessons` rỗng + file 403; ngoài lớp 403; HV POST activity/files 403; quiz draft →
refId null. Chi tiết đầy đủ: `CURRENT_STATE.md §P7`.

---

### Phase P6: Polish & Gamification — ✅ HOÀN THÀNH (2026-08-17)

- **T6.1 (In-app Notification)**: Schema + contracts + NotificationsModule + Domain triggers (`gate.opened`, `submission.graded`, `certificate.issued`, `certificate.revoked`, `badge.awarded`) trong cùng `$transaction` + FE `NotificationBell` header dropdown + badge unread + mark read.
- **T6.2 (Teacher Class Report)**: `GET /classes/:classId/report` tính số lượng học viên, tỷ lệ hoàn thành khóa, điểm trung bình, phân phối điểm và tiến độ từng bài đã mở gate + Tab Báo cáo & Thống kê trong TeachClasses.
- **T6.3 (Audit Log Viewer)**: `GET /audit` (phân trang + lọc theo actor/action/entity/date) + Tab Nhật ký hệ thống trong AdminHome + Modal xem JSON meta chi tiết.
- **T6.4 (Teacher Authoring Polish)**: Thêm inline sửa/xóa Section và Lesson trong TeachCourses.
- **T6.5 (Quiz Publish Switch)**: Thêm trường `Quiz.published` vào Schema/Contracts + toggle `.cx-toggle` trong TeachQuiz.
- **T6.6 (i18n Parity)**: Đồng bộ 100% bộ key giữa `vi.json` và `en.json` (0 missing keys).
- **D1 (PDF Certificate Generation & Storage)**: Tích hợp `pdf-lib` sinh PDF chứng chỉ khổ ngang A4 (màu vàng/teal, serial, verification code) + `LocalStorageAdapter` (`uploads/`) + endpoint `GET /certificates/:id/pdf` tải file PDF.
- **D2 (Verify Certificate Privacy)**: Gỡ bỏ `finalScore` khỏi `PublicVerificationDto` và trang `VerifyCertificate.tsx` (chống lộ điểm số trên QR code công khai).
- **D3 (Separate Template Permission)**: Thêm quyền `certificate.template.manage` (`CERTIFICATE_TEMPLATE_MANAGE`) tách biệt với quyền cấp phát chứng chỉ.
- **D4 (Real Gamification ADR 002)**: Schema (`XpEvent`, `UserStreak`, `Badge`, `UserBadge`) + tính Level/XP/Streak pure function + tự động trao huy hiệu + trigger XP khi hoàn thành bài học (50 XP), pass quiz (100 XP), pass coding (100 XP) trong cùng transaction + FE `GreetingHero` và Streak pill hiển thị dữ liệu thật từ `/gamification/me`.
- **D5 (Lesson Discussion / Comments)**: Schema (`LessonComment`) + CommentsModule (`GET/POST /lessons/:id/comments?classId=`) + FE `LessonCommentsSection` tích hợp trong `LearnHome > LessonDetail`.

---

## Bản vá đã hoàn thành

Ba bản vá của phiên P7 (lỗi bảo mật P5 `currentUser.id`, PDF chứng chỉ tiếng Việt, thêm học viên bằng
email) đã chuyển sang [docs/archive/completed_tasks/2026-08-19-p5-p6-p1-fixes.md](../../docs/archive/completed_tasks/2026-08-19-p5-p6-p1-fixes.md).

## Nợ kỹ thuật đã giải quyết (Phase P6 Tech Debt Cleaned)

- ✅ **P5 L2**: Trang verify công khai đã gỡ bỏ `finalScore` (D2 fix).
- ✅ **P5 L3**: `certificates.createTemplate` đã chuyển sang quyền `CERTIFICATE_TEMPLATE_MANAGE` (D3 fix).
- ✅ **P5 PDF**: Đã sinh PDF chứng chỉ hoàn chỉnh qua `pdf-lib` + `StorageAdapter` lưu file và tải về qua `GET /certificates/:id/pdf` (D1 fix).
- ✅ **Quiz.published**: Đã thêm trường schema + toggle hoạt động trong TeachQuiz (T6.5).
- ✅ **Gamification**: Đã chuyển từ mock sang backend thật (Level, XP, Streak, Badges, triggers) (D4 fix).
- ✅ **Discussion/comment**: Đã có module comment + form thảo luận bài học (D5 fix).
- ✅ **Section/Lesson edit/delete**: Đã có UI inline edit/delete trong TeachCourses (T6.4).

---

## Completed Phase Summary

- **P0** Done: scaffold monorepo, Prisma/Postgres/Redis, auth JWT + refresh cookie, PBAC, users/rbac CRUD, seed, FE login/admin shell.
- **P1** Done: course/section/lesson, class/course/member/gate/progress, Teach/Learn FE, PBAC scope theo lớp, lesson gate invariant.
- **P2** Done: assignment/submission schema + contracts + backend + seed + FE Teach/Learn chấm tay.
- **P3** Done (merge `main` qua PR #1): contracts + schema coding, backend authoring, seed perms, runner adapter (Piston/Stub) + BullMQ/Inline queue, submit/autograde server-side (Decimal weighted), FE Teach coding, FE Learn coding (Monaco + Pyodide self-host, no CDN) + submit/polling. Không lộ hidden test.
- **P4** Done: quiz engine (5 loại câu hỏi) + autograde server-side (Decimal weighted, passScore) + FE Teach/Learn quiz. INVARIANT: `isCorrect`/`correctAnswer` KHÔNG gửi client khi làm bài (chỉ đúng/sai sau nộp); không hard-delete attempt/answer.
- **P5** Done (T5.0–T5.7 + 2 vòng review fix): `grading` (tổng hợp sổ điểm từ assignment+quiz+coding, GradeItem/GradeEntry) + `certificates` (issue có gate hoàn thành ≥80% + finalScore ≥60% từ gradebook thật; revoke; AuditLog cùng transaction; không hard-delete) + public `GET /verify/:code` (zero PII) + FE Teach sổ điểm/cấp-thu hồi + FE Learn điểm cá nhân + trang verify công khai. **Review đã đóng H1–H4, M1–M3, H3, completion-by-course**: GET gradebook read-only (write tách sang `POST .../gradebook/recompute`); quiz maxScore = Σ points; student không có `grade.read`/`certificate.read`; mã dùng `crypto.randomBytes`. `pnpm validate` 16/16 (api 140 test). Main local `939a791`, chưa push origin.

## Verification Commands

```bash
pnpm validate
npx prisma format && npx prisma validate
```
