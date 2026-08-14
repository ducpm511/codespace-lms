# Active Tasks

<!-- SIZE LIMIT: 200 lines. Do not exceed. -->
<!-- Completed task history -> docs/archive/completed_tasks/ -->

Updated: 2026-08-14

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
| **P4** Quiz | quiz engine + autograde | ✅ Done (merged main local) |
| **P5** Gradebook & Certificate | tổng hợp điểm, cấp + verify chứng chỉ | ⬅️ Next |
| **P6** Polish | notification, audit UI, báo cáo | Not started |

Phụ thuộc chung: `contracts -> prisma schema -> backend -> frontend`.

---

## Active Phase

### Phase P4: Quiz (engine + autograde) — ✅ DONE (chờ merge main)

Status: ✅ **T4.0–T4.7 hoàn tất.** contracts + schema + seed + backend authoring + attempt/autograde + **FE Teach quiz + FE Learn quiz + nền Nocturne**.
`pnpm validate` xanh **16/16** (api **129 test**, web 4 test), web typecheck/lint/build xanh, live e2e authoring + full student flow (Teach tạo quiz + Learn làm bài chấm server-side 4/4) xanh, regression KHÔNG lộ isCorrect/correctAnswer. **Chờ user quyết định merge main** (như P3 qua PR). Goal (docs/DESIGN.md
§4.6, §5.2): quiz nhiều loại câu hỏi
(single/multiple choice, true/false, short_answer, code_fill); học viên làm bài trong lớp (lesson gated),
nộp → **chấm tự động server-side**, điểm `Decimal` weighted theo `Question.points`, `passScore` ngưỡng đạt.

**Branch**: `claude/codespace-p4-quiz` (tách từ `main` sau khi P3 merge PR #1).

**INVARIANT cốt lõi P4** (mirror P3 hidden test): `QuestionOption.isCorrect` + `Question.correctAnswer`
KHÔNG BAO GIỜ gửi ra client khi làm bài. Student DTO (`QuizStudentDetail`) chỉ có prompt + options text.
Điểm chấm lại server-side, KHÔNG tin client. KHÔNG hard-delete `QuizAttempt`/`QuizAnswer`.

#### Task Breakdown (P4)

| Task | Scope | Surface | Risk | Order |
|---|---|---|---|---|
| ✅ **T4.0** Contracts quiz: `quiz.ts` (QuizSummary + Student/Author detail tách isCorrect, attempt/answer, create/upsert requests) + permission keys `quiz.*` (read/create/update/delete/submit/result.read) | contracts | contracts | Med | 1 |
| ✅ **T4.1** Schema quiz: `Quiz`, `Question`, `QuestionOption`, `QuizAttempt`, `QuizAnswer` + enum `QuizQuestionType`/`QuizAttemptStatus` + index + migration `p4_quiz` (áp DB). points/passScore/score `Decimal`; `QuestionOption.isCorrect` + `Question.correctAnswer` author-only | schema | schema | High | 2 |
| ✅ **T4.2** Seed permission quiz cho admin/instructor/TA/student (mirror coding). Seed: 36 perm / 106 liên kết (student=submit+result.read, TA=read+result.read, instructor/admin=full authoring) | schema | seed | Med | 3 |
| ✅ **T4.3** Backend quiz authoring module `apps/api/src/quiz/`: CRUD quiz (`/quizzes`) + upsert/xóa question (`:id/questions`) với options lồng (replace trong transaction), PBAC `quiz.*` + IDOR; author DTO CÓ isCorrect/correctAnswer; validate loại câu hỏi (choice ≥2 opt + ≥1 đúng; single/true_false đúng 1 đáp án). 11 unit test + live smoke authoring xanh | backend | api | High | 4 |
| ✅ **T4.4** Backend attempt + autograde: `GET /quizzes/for-class/:classId` (membership, gated/no-lesson), `GET /quizzes/:id/attempt?classId` (student DTO KHÔNG isCorrect/correctAnswer), `POST /quizzes/:id/attempts` (nộp + CHẤM 1 lần, enforce attemptsAllowed), `GET /quiz-attempts/:id` (ownership hoặc quiz.result.read). Chấm server-side: choice exact-set-match, text normalized (trim+lowercase+gộp space); score Decimal weighted; lưu QuizAnswer + attempt + LessonProgress trong 1 transaction. 21 unit test + full e2e smoke xanh | backend | api | High | 5 |
| ✅ **T4.5** FE Teach quiz + **nền Nocturne**: port `nocturne-tokens.css` → `apps/web/src/styles/nocturne.css` (token + component classes, **scope-safe**: KHÔNG áp reset typography toàn cục → màn cũ light-slate KHÔNG regression; ground tối bọc trong `.nocturne-surface`), import ở `main.tsx`, assets → `public/brand/`. `features/quiz` (api+hooks mirror coding) + `pages/teach/TeachQuiz.tsx` (course picker → tạo quiz → list → editor: settings dialog + question manager, 5 loại câu hỏi, option editor đánh dấu đáp án). Tab `quiz` TeachHome, i18n vi/en (`quiz.*` 60 key + `teach.tab_quiz`). Author thấy đáp án (invariant chỉ chặn student surface). Verify: web typecheck/lint/build xanh; live smoke (GV tạo quiz + câu hỏi single_choice + short_answer → editor render đúng Nocturne, computed token khớp; màn cũ không regression) | frontend | web | Med | 6 |
| ✅ **T4.6** FE Learn quiz: `pages/learn/LearnQuiz.tsx` (Nocturne `.nocturne-surface`) — list quiz theo lớp → workspace làm bài (render 5 loại câu hỏi KHÔNG đáp án: radio single/tf, checkbox multi, input/textarea text) → submit `POST :id/attempts` → result (score/maxScore + mascot hearts/grumpy + tag đạt/chưa đạt + per-question Đúng/Sai + awardedPoints, **KHÔNG lộ đáp án đúng**) + "Làm lại" reset. Handle 403 hết lượt (ApiError.status). Wire vào `LearnHome`. i18n bổ sung `answerPlaceholder`. Verify live: student làm quiz 3 câu (single+multi+short) → 4/4 chấm server-side, per-question đúng, regression đề+kết quả KHÔNG có isCorrect/correctAnswer | frontend | web | Med | 7 |
| ✅ **T4.7** Verify live: `pnpm validate` xanh 16/16 (api 129 + web 4 test), web build xanh; live e2e GV tạo quiz + câu hỏi → student làm → chấm tự động 4/4 server-side; regression: đề + kết quả student KHÔNG lộ isCorrect/correctAnswer (verified API payload + UI) | test | all | High | 8 |

Dependency: T4.0–T4.7 ✅ **P4 DONE** -> chờ merge main -> P5 Gradebook & Certificate.

#### Autograde rules (T4.4)
- `single_choice`/`true_false`: đúng khi tập option đã chọn == đúng 1 option isCorrect.
- `multiple_choice`: đúng khi tập option đã chọn == đúng tập isCorrect (khớp hoàn toàn).
- `short_answer`/`code_fill`: đúng khi `normalize(textAnswer) == normalize(correctAnswer)` (trim + lowercase);
  nếu `correctAnswer` null → 0 điểm (chờ chấm tay sau, ngoài MVP).
- Điểm câu = `points` nếu đúng, 0 nếu sai. `score = Σ awardedPoints` (Decimal, 2dp).

#### Acceptance Criteria (P4)
- `pnpm validate` + `npx prisma format && npx prisma validate` pass; migration áp sạch.
- GV tạo quiz gắn course/lesson, nhiều loại câu hỏi + đáp án; client student KHÔNG nhận isCorrect/correctAnswer.
- Học viên trong lớp (lesson gated) làm quiz, nộp → chấm tự động, điểm Decimal weighted, cập nhật trạng thái/tiến độ.
- attemptsAllowed enforce; không hard-delete attempt/answer; PBAC/IDOR theo lớp như P2/P3.

---

## Completed Phase Summary

- **P0** Done: scaffold monorepo, Prisma/Postgres/Redis, auth JWT + refresh cookie, PBAC, users/rbac CRUD, seed, FE login/admin shell.
- **P1** Done: course/section/lesson, class/course/member/gate/progress, Teach/Learn FE, PBAC scope theo lớp, lesson gate invariant.
- **P2** Done: assignment/submission schema + contracts + backend + seed + FE Teach/Learn chấm tay.
- **P3** Done (T3.0–T3.9, merge `main` qua PR #1): contracts + schema coding, backend authoring, seed perms, runner adapter (Piston/Stub) + BullMQ/Inline queue, submit/autograde server-side (Decimal weighted), FE Teach coding, **FE Learn coding (Monaco + Pyodide self-host, no CDN) + submit/polling**. `pnpm validate` xanh 16/16 (api 108 test), live e2e xanh, không lộ hidden test.

## Verification Commands

```bash
pnpm validate
npx prisma format && npx prisma validate
```
