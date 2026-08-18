# Active Tasks

<!-- SIZE LIMIT: 200 lines. Do not exceed. -->
<!-- Completed task history -> docs/archive/completed_tasks/ -->

Updated: 2026-08-16

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

Phụ thuộc chung: `contracts -> prisma schema -> backend -> frontend`.

Ngoài roadmap: **Playful redesign FE** (apps/web) ✅ Done — re-skin gamified toàn app trên nền Nocturne
(chi tiết `CURRENT_STATE.md §Playful/gamified redesign`).

---

## Active Phase

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
