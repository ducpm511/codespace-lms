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

Phụ thuộc chung: `contracts -> prisma schema -> backend -> frontend`.

Ngoài roadmap: **Playful redesign FE** (apps/web) ✅ Done — re-skin gamified toàn app trên nền Nocturne
(chi tiết `CURRENT_STATE.md §Playful/gamified redesign`).

---

## Active Phase

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

## 🛡️ Lỗi bảo mật P5 phát hiện khi làm P7 — ✅ ĐÃ VÁ (2026-08-19)

`@CurrentUser()` trả `AuthPrincipal { userId }`, nhưng `certificates.service.ts` + `grading.service.ts` khai kiểu
`AuthUser` rồi đọc `currentUser.id`/`currentUser.roles` → **luôn `undefined` lúc chạy**. Hậu quả đã xác nhận
trên DB dev TRƯỚC khi vá:

1. `RbacService.getEffectivePermissions(undefined)` → `userRole.findMany({ where: { userId: undefined } })` —
   Prisma **bỏ qua filter** → trả toàn bộ user_roles → hợp nhất quyền mọi role ≈ super_admin. Mọi kiểm quyền
   trong `certificates` đều pass.
2. `certificates.listMine` `where: { userId: undefined }` → trả **MỌI chứng chỉ của mọi học viên**.
3. `POST /certificates/:id/revoke` (chỉ `JwtAuthGuard`, scope kiểm trong service) → user bất kỳ thu hồi được
   chứng chỉ người khác. `GET /certificates/:id/pdf` IDOR mở tương tự.
4. `GET /classes/:classId/my-gradebook` **500** `PrismaClientValidationError` (endpoint hỏng hoàn toàn).

**Đã vá**: `certificates`/`grading` dùng `AuthPrincipal` + `currentUser.userId`; bỏ shortcut `currentUser.roles`
(admin/super_admin nhận quyền ở phạm vi GLOBAL nên `hasPermission` đã phủ — đối chiếu seed);
`getEffectivePermissions` trả quyền RỖNG khi `userId` falsy (phòng thủ chiều sâu, không chạm DB).
Test hồi quy: rbac userId rỗng, revoke 403 + tra đúng userId, `listMine` lọc đúng userId, `getPdfBuffer` IDOR.
Live sau vá: `my-gradebook` 200; HV không sở hữu `/certificates/mine` = 0 (chủ sở hữu = 1);
`GET /:id/pdf` 403; `POST /:id/revoke` 403; GV vẫn đọc được `/certificates/class/:id` + gradebook (200).
**KHÔNG do P7 gây ra.**

## 🖨️ PDF chứng chỉ chết với tiếng Việt (P6/D1) — ✅ ĐÃ VÁ (2026-08-19)

Trước vá: `GET /certificates/:id/pdf` trả **500** — `WinAnsi cannot encode "ơ" (0x01a1)`. `pdf-lib`
`StandardFonts` (Helvetica) mã hóa WinAnsi nên mọi tên học viên / tiêu đề khóa có dấu đều làm sinh PDF chết —
tính năng chứng chỉ PDF thực tế hỏng với dữ liệu tiếng Việt. (Nhãn tĩnh trong generator trước đây đã phải
**bỏ dấu** để né lỗi: "CHUNG NHAN HOAN THANH…".)

**Đã vá**: nhúng **Roboto** (Apache-2.0, phủ đủ Vietnamese) qua `@pdf-lib/fontkit` —
`registerFontkit` + `embedFont(bytes, { subset: true })`. Font lấy từ npm `roboto-fontface` (WOFF —
`@pdf-lib/fontkit` đọc trực tiếp), nạp bằng `require.resolve` + cache buffer ở module scope →
**không commit binary vào repo, không cần cấu hình copy asset cho `nest build`**. Nhãn tĩnh đã khôi phục
dấu đầy đủ.

Verify: 3 unit test mới (`certificate-pdf.generator.spec.ts`) — tên/khóa có dấu, dải dấu đầy đủ
(ơ ư ạ ế ữ Đ ỗ ằ), ASCII thuần. Kiểm glyph bằng `fontkit.layout()`: **0 `.notdef`** trên mọi chuỗi thật
(không có ô vuông tofu). Live: `GET /certificates/:id/pdf` **200 application/pdf ~18KB** cho cả GV có quyền
lẫn chủ sở hữu (trước là 500). Phát hiện khi verify P7, **không do P7**.

---

## 👥 Thêm học viên vào lớp bằng EMAIL — ✅ ĐÃ VÁ (2026-08-19)

Nợ từ P1: form enroll ở `TeachClasses` bắt nhập **userId thô**, mà giáo viên KHÔNG có `user.read` (chỉ admin có)
→ không có cách nào tra id từ trong UI.

**Đã vá**: `GET /users/lookup?email=` — khớp email **CHÍNH XÁC** (không tìm gần đúng/tiền tố, hạn chế dò danh sách
user), chuẩn hóa lowercase+trim, trả `UserLookupDto` tối giản `{id, email, fullName}` (KHÔNG lộ role/status).
Quyền dùng `class.manage` (giáo viên có) thay vì nới `user.read`. Route đặt TRƯỚC `:id`.
FE: ô nhập đổi sang **email**, tra ngầm khi chuỗi đã giống email, hiện tên xác nhận trước khi thêm
("Sẽ thêm: X" / "X đã ở trong lớp này" / "Không tìm thấy"), nút Thêm disable tới khi tra ra người hợp lệ.
Bỏ key i18n `classes.userId`, thêm `memberEmail/lookingUp/foundUser/alreadyMember/userNotFound` (vi+en).

Live: GV tra đúng email → 200; HOA/thừa khoảng trắng → vẫn 200; email lạ → 404; sai định dạng → 400;
học viên (không có `class.manage`) → 403. UI: thêm được học viên bằng email, danh sách cập nhật, ô nhập tự xóa.

---

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
