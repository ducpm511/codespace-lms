# Active Tasks

<!-- SIZE LIMIT: 200 lines. Do not exceed. -->
<!-- Completed task history -> docs/archive/completed_tasks/ -->

Updated: 2026-08-26

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
| **P9** Production readiness | env fail-fast + helmet/rate-limit, quản trị user trên UI, vòng đời mật khẩu, storage bền, đóng gói & deploy | ✅ Done + **đã deploy thật** |
| **P10** Gamification G2 + Admin redesign | xếp hạng theo lớp/tuần, mục tiêu lớp, giáo viên trao thưởng, streak nhân văn, áp design mới khu Quản trị | 🔄 **Đang chạy** — T10.1/T10.3/T10.5 ✅ **đã lên production** (`main` = `a10b41f`, 2026-08-26); còn T10.2, T10.4 |

Phụ thuộc chung: `contracts -> prisma schema -> backend -> frontend`.

Ngoài roadmap: **Playful redesign FE** (apps/web) ✅ Done — re-skin gamified toàn app trên nền Nocturne
(chi tiết `docs/archive/completed_tasks/pre-p7-history.md`).

---

## Active Phase

### Phase P10 — Gamification giai đoạn 2 + Admin redesign 🔄 ĐANG CHẠY

**T10.1 · T10.3 · T10.5 ✅ xong và đã chạy trên production.** Còn **T10.2** và **T10.4**
(T10.4 chặn bởi H5 — `Class` chưa có lịch học hằng tuần, phải hỏi người trước khi code).

Kế hoạch đầy đủ, trạng thái production và bẫy đã gặp: **`.harness/agent/HANDOFF_P10.md`**.
Mẫu thiết kế khu Quản trị: `apps/web/design_handoff_lms_ui/CodeSpace-LMS-admin-v2.html`.

- **T10.1** ✅ **XONG** — Bảng xếp hạng theo **lớp**, theo **tuần** (reset thứ Hai).
  `XpEvent.classId` (nullable) + index `(classId, createdAt)` + migration `20260826090000_p10_xp_class_scope`
  có backfill suy lớp từ `lesson_progress`/`quiz_attempts`/`coding_submissions`.
  `GET /classes/:classId/leaderboard?week=current|previous` — KHÔNG gắn `@RequirePermission` (học viên
  không có `class.read`), quyền kiểm ở service: thành viên đang hoạt động HOẶC `class.read` đúng lớp đó.
  Chỉ xếp hạng `roleInClass=student`; đồng điểm đồng hạng; FE `ClassLeaderboard` trong `LearnHome`.
  ✅ **Đã chạy thật trên DB dev**: backfill gắn đúng lớp, đồng hạng đúng, học viên xem được.
- **T10.2** Mục tiêu chung của lớp (`ClassGoal`) → huy hiệu tập thể.
- **T10.3** ✅ **XONG** — GV trao huy hiệu tay / thưởng XP kèm lời nhắn.
  `Badge.isManual`, `UserBadge.awardedById|classId|note`, `XpEvent.note`; migration
  `20260826120000_p10_manual_awards`; seed 3 huy hiệu tay (`helping_hand`, `good_question`,
  `big_progress`). `POST /gamification/students/:studentId/awards` (**không** phải
  `/users/:id/badges` như bản nháp — một endpoint lo cả huy hiệu lẫn XP nên tên theo việc nó làm).
  Quyền: `grade.write` **và** phải là instructor/ta CỦA CHÍNH LỚP ĐÓ — chỉ kiểm permission là hở,
  vì role `instructor` đang gán global. XP thưởng tay có trần 5–200 để một lượt không lật cả
  bảng xếp hạng. FE: `AwardPanel` ngay dưới form chấm bài trong `TeachAssignments`.
  3 huy hiệu trao tay nằm ở **migration** `20260826150000_p10_seed_manual_badges`, KHÔNG chỉ ở
  `seed.cjs` — `ops/release.sh` không chạy seed nên để ở seed thì ô chọn huy hiệu RỖNG trên production.
- **T10.4** Streak nhân văn: vé nghỉ phép, khớp lịch học thật (bỏ cuối tuần nếu lớp không học).
- **T10.5** ✅ **XONG** — Áp design mới khu Quản trị.
  `pages/admin/adminUi.ts` (thuần logic): `ROLE_META` / `STATUS_META` (icon Phosphor fill + màu),
  `GROUP_META` 6 nhóm hành động (**không có `login`**, thêm `award` cho `gamification.award`),
  `auditSentence` / `auditChips` / `auditTime`. Nhật ký từ bảng thô thành danh sách câu đọc được,
  `metaJson` mở rộng TẠI CHỖ (bỏ modal JSON). Dãy số liệu: `GET /admin/overview` (module `admin`,
  quyền `user.read`, 3 query cố định, loại tài khoản `suspended`).
  ✅ **Đã xem thật trên giao diện**: nhật ký thành câu, chip vai trò/trạng thái, dãy số liệu.

### ⚠️ Việc vận hành CÒN LẠI trên máy thật

P10 đã phát hành (2026-08-26). O1 (Piston) và O3 (đo RAM) đã xong từ P9. Còn lại:

| # | Việc | Trạng thái |
|---|---|---|
| O2 | Smoke đầy đủ RUNBOOK §4 **qua giao diện thật** | ❌ chưa — mới kiểm ở mức HTTP |
| O4a | Thử `ops/restore.sh` | ✅ **XONG 2026-08-26** — phục hồi vào DB tạm, kiểm sâu, khớp bản chạy |
| O4b | **Sao lưu ngoài máy** — cả 2 file đang nằm trên chính con VPS | ❌ **RỦI RO CAO NHẤT**, chặn bởi H3 |
| O4c | Lịch sao lưu tự động | ❌ chưa — máy KHÔNG có cron, dùng systemd timer (mẫu RUNBOOK §5) |
| O5 | Đổi mật khẩu admin, xoá `SEED_ADMIN_*` khỏi `.env.production` | ❌ chưa |
| O6 | ✅ **ĐÃ ĐÓNG 03/09**: khoá host đổi vì máy reboot 01/09, cloud-init sinh lại khoá. Xác minh qua console TINO; `known_hosts` đã cập nhật. Vân tay lưu ở `HANDOFF_P10.md`. | — |
| O7 | 🚨 **Đặt sẵn mật khẩu console cho `deploy`**: user tạo bằng `--disabled-password`, root không có mật khẩu → chỉ vào console được sau khi reset mật khẩu root qua bảng điều khiển TINO. Cất vào trình quản lý mật khẩu. | — |
| O8 | ✅ **XONG 04/09**: đã xem bằng mắt trên máy dev cả 4 bản vá (markdown học viên, đề bài tập, sửa đề lập trình, gỡ học viên) + favicon. Dữ liệu thử đã dọn. | — |

### Việc cần người quyết (không agent nào làm thay được)

| # | Việc | Chặn cái gì |
|---|---|---|
| H1 | Tài khoản Cloudinary → `STORAGE_DRIVER=cloudinary` | Xác minh T9.3 thật; giảm rủi ro mất file |
| H2 | Chốt email provider (gợi ý Resend) | Quên-mật-khẩu |
| H3 | **Chốt đích sao lưu ngoài máy (R2/B2)** | **O4b — rủi ro cao nhất hiện nay** |
| H5 | `Class` chưa có lịch học hằng tuần → "streak khớp lịch học" dựa vào đâu? | **T10.4** (xem HANDOFF §T10.4) |
| ~~H4~~ | ✅ **Đã chốt 2026-08-26** — audit không tra tên (câu mô tả chung, 0 PII); **bỏ hẳn** nhóm login; **thêm** dãy số liệu khu Quản trị. Chi tiết `HANDOFF_P10.md §T10.5`. | — |

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

**Nợ nhỏ của P8 — ✅ đã trả hết trong P9:** `GET /teach/overview` (gộp N request + chip "chờ chấm"),
`useUpdateClass` / gỡ khóa khỏi lớp / `useUpdateAssignment` (`useUpdateCodingProblem` hoá ra đã có sẵn),
và tên file PDF mojibake (vá lúc upload ở P8 + script dọn dữ liệu cũ ở P9).

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
