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
| **P6** Polish | notification, audit UI, báo cáo | ⬅️ Next (chưa breakdown) |

Phụ thuộc chung: `contracts -> prisma schema -> backend -> frontend`.

Ngoài roadmap: **Playful redesign FE** (apps/web) ✅ Done — re-skin gamified toàn app trên nền Nocturne
(chi tiết `CURRENT_STATE.md §Playful/gamified redesign`).

---

## Active Phase

### Phase P6: Polish — ⬅️ Next (chưa breakdown task)

Nội dung dự kiến (docs/DESIGN.md §4.8, §10): `Notification` (in-app + trigger domain), audit UI (xem
`AuditLog`), báo cáo/thống kê lớp. Chưa chốt task — cần đọc DESIGN + breakdown khi bắt đầu.

---

## Nợ kỹ thuật ghi nhận (không chặn — dọn ở P6/Polish)

- **P5 L2**: trang verify công khai trả thừa `finalScore` (DESIGN §5.3 chỉ yêu cầu tên/khóa/ngày).
- **P5 L3**: `certificates.createTemplate` dùng chung quyền `CERTIFICATE_ISSUE` — nên tách quyền admin riêng.
- **P5**: sinh **PDF chứng chỉ** chưa làm (MVP chỉ có record + verify page; `Certificate.pdfFileId` để null) —
  cần chốt lib (pdf-lib/puppeteer) + `StorageAdapter` private (R2) khi làm.
- **Quiz.published**: chưa có field (schema + contract) → publish toggle ở TeachQuiz đang PLACEHOLDER disabled.
- **Gamification** (streak/XP/badge/level ở Learn hero) — UI MOCK tĩnh, chưa có backend.
- **Discussion/comment** (lesson detail) — placeholder tĩnh, chưa có API.
- Cũ (P1): FE chưa sửa/xóa section/lesson/gán-khóa; enroll nhập `userId` thô (chưa tra theo email).

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
