# Current State

<!-- SIZE LIMIT: 500 lines. Do not exceed. Refactor into specialized docs if approaching limit. -->

Updated: 2026-08-14

## Project Stage

**P0–P3 ✅ DONE. Phase P4 (Quiz) đang chạy: T4.0–T4.5 ✅ (contracts + schema + seed + authoring + attempt/autograde + FE Teach quiz + nền Nocturne).**
Branch FE `claude/p4-quiz-fe-nocturne-7759f7` (reset lên đỉnh P4 backend `d206ecd`, chưa merge main). **Kế tiếp T4.6 FE Learn quiz**
(theo **Nocturne design handoff** — xem memory + `apps/web/design_handoff_lms_ui/`) → T4.7 verify. `pnpm
validate` xanh 16/16 (api **129 test**), web typecheck/lint/build xanh, live smoke authoring + full student flow + FE Teach quiz xanh.

### T4.5 (FE Teach quiz + nền Nocturne) — 2026-08-14
- **Nền Nocturne** (bước khởi động redesign chung): port `design_handoff_lms_ui/nocturne-tokens.css` →
  `apps/web/src/styles/nocturne.css` (GIỮ nguyên giá trị token + component classes `.btn/.card/.tag/.field/
  .input/.seg/.radio/.checkbox/.table/.dialog`). **SCOPE-SAFE**: KHÔNG áp reset typography toàn cục
  (body/h1..h6/p/a/img) → các màn cũ light-slate KHÔNG regression (verified: app root vẫn slate-50, h1 vẫn
  20px Tailwind, white card vẫn trắng). Ground tối + heading Nocturne bọc trong `.nocturne-surface`. Import ở
  `main.tsx` (TRƯỚC index.css để Tailwind utilities thắng). Logo + mascot → `apps/web/public/brand/`.
- **FE quiz**: `features/quiz/{api,hooks}.ts` mirror `features/coding` (author CRUD: list/get/create/update/
  delete quiz + upsertQuestion/deleteQuestion; student: listForClass/getAttempt/submitAttempt/getAttemptResult).
  `pages/teach/TeachQuiz.tsx`: course picker → CreateQuizForm → QuizList (selected accent-900) → QuizEditor
  (header meta + settings dialog updateQuiz + delete) → QuestionsManager (5 loại: single/multiple/true_false/
  short_answer/code_fill; option editor radio(single/tf)/checkbox(multi) đánh dấu isCorrect; correctAnswer cho
  short/code_fill; auto-seed 2 opt cho true_false). Author XEM đáp án — invariant chỉ chặn student surface.
- Tab `quiz` trong `TeachHome`; i18n `quiz.*` (60 key vi/en, parity OK) + `teach.tab_quiz`.
- **Verify**: web typecheck + lint (1 warning cũ useSampleRunner, không phải task này) + build xanh. Live smoke:
  login GV → tab Trắc nghiệm render Nocturne (computed token khớp: bg #161826, accent #9184d9, surface #232532,
  radius 8px, Inter) → tạo quiz + câu hỏi single_choice(✓ đánh dấu đáp án) + short_answer(correctAnswer) →
  editor render đúng. Chỉ 401 transient (auth refresh pattern sẵn có), KHÔNG lỗi JS/render. Màn cũ không regression.
- **⚠️ Trạng thái transition**: hiện chỉ màn quiz (Teach) dùng Nocturne (self-contained dark surface); các màn
  khác (courses/classes/assignments/coding + Learn + Admin + AppLayout + Login) VẪN light-slate. Re-skin toàn app
  theo README là redesign chung nối tiếp (ngoài scope T4.5). T4.6 Learn quiz cũng dùng `.nocturne-surface`.

### T4.4 (Quiz attempt + autograde) — 2026-08-14
- Endpoints: `GET /quizzes/for-class/:classId` (student list, membership + gated/no-lesson),
  `GET /quizzes/:id/attempt?classId` (QuizStudentDetail — KHÔNG isCorrect/correctAnswer),
  `POST /quizzes/:id/attempts` (nộp + CHẤM 1 lần — tránh dangling attempt, enforce attemptsAllowed),
  `GET /quiz-attempts/:id` (ownership hoặc quiz.result.read scoped, controller `quiz-attempts.controller.ts`).
- Chấm server-side (`gradeQuestion`): choice = exact-set-match option isCorrect; text = normalize
  (trim+lowercase+gộp space) == correctAnswer. Điểm câu = points nếu đúng, 0 nếu sai. score = Σ (Decimal 2dp).
  Lưu QuizAnswer + attempt(submitted) + LessonProgress (đạt passScore + gated → completed) trong 1 transaction.
  selectedOptionIds lọc chỉ option hợp lệ (chống rác client). KHÔNG tin điểm client.
- QuizService thêm inject RbacService (getAttempt scope theo lớp, giống coding.getSubmission). 21 unit test.
- Full e2e smoke xanh: gated quiz → for-class → attempt (no leak) → submit → score 5/5, per-answer isCorrect →
  view attempt → nộp lần 2 (attemptsAllowed=1) 403 → lesson completed. Regression: đề + kết quả KHÔNG lộ đáp án.

### T4.2/T4.3 (Quiz seed + backend authoring) — 2026-08-14

### T4.2/T4.3 (Quiz seed + backend authoring) — 2026-08-14
- **Seed** `quiz.*` (6 perm) vào seed.cjs: 36 permission / 106 liên kết. student=submit+result.read,
  TA=read+result.read, instructor/admin=full authoring. Đã chạy seed áp DB.
- **Module** `apps/api/src/quiz/` (wired app.module): `QuizController` `/quizzes` CRUD + `:id/questions`
  upsert/xóa (PBAC `quiz.*`). `QuizService`: create/list/getAuthorDetail/update/remove/upsertQuestion/
  removeQuestion. Upsert question REPLACE options trong `$transaction` (deleteMany + createMany). Validate
  loại câu hỏi (choice ≥2 opt + ≥1 đúng; single/true_false đúng 1). Author DTO lộ isCorrect+correctAnswer.
  DTO nested options `@ValidateNested`+`@Type` (ValidationPipe transform+whitelist). 11 unit test.
- **Live smoke authoring**: admin tạo quiz + single_choice + short_answer → author detail đủ isCorrect/
  correctAnswer, list maxScore đúng; single_choice 2 đáp án đúng → 400; field lạ → 400 (whitelist).
- **GOTCHA lặp lại**: tắt API dev trước khi `prisma generate`/`migrate` (khóa query_engine dll).

### T4.0/T4.1 (Quiz contracts + schema) — 2026-08-14
- **Contracts** `packages/contracts/src/quiz.ts`: `QuizSummary`; student-facing `QuizStudentDetail`/
  `StudentQuizQuestionDto`/`StudentQuizOptionDto` (KHÔNG isCorrect/correctAnswer); author `QuizAuthorDetail`/
  `AuthorQuizQuestionDto`/`AuthorQuizOptionDto` (CÓ isCorrect + correctAnswer); attempt `QuizAttemptDto` +
  `QuizAnswerResultDto`; requests Create/Update/UpsertQuestion(+Option)/Start/Submit. Perm keys `quiz.*`
  (read/create/update/delete/submit/result.read) trong rbac.ts. Export ở index.ts.
- **Schema** `p4_quiz` migration áp DB (5433): `Quiz`(passScore/attemptsAllowed/shuffle*), `Question`
  (type enum, points Decimal, correctAnswer? author-only), `QuestionOption`(isCorrect author-only),
  `QuizAttempt`(status enum, score Decimal), `QuizAnswer`(selectedOptionIds Json, textAnswer, awardedPoints,
  isCorrect). Back-relations User/Course/Lesson/Class. KHÔNG hard-delete attempt/answer.
- **GOTCHA**: `prisma generate` bị EPERM khi API dev đang chạy (khóa `query_engine-windows.dll.node`) —
  TẮT API trước khi generate/migrate.

### P3 (Coding & Runner) — DONE, merge main qua PR #1
**P0 ✅ + P1 ✅ + P2 ✅ + P3 ✅ DONE. Phase P3 (Coding & Runner) hoàn tất T3.0–T3.9. Đã merge main.**
P3: ADR runner (T3.0), contracts `coding.ts` + `coding.*` perms (T3.1), schema + migration (T3.2),
backend `coding` authoring (T3.3), seed coding (T3.6), runner adapter + queue (T3.4), submit/autograde
(T3.5), FE Teach (T3.7), **FE Learn coding (T3.8): Monaco + Pyodide self-host + submit/polling** + **verify
live (T3.9)**. `pnpm validate` xanh 16/16, **api 108 test**, web build/typecheck/lint xanh. Postgres+Redis
docker (5433/6380).

### T3.8/T3.9 (FE Learn coding + verify) — 2026-08-14
- **Backend gap đã vá**: `GET /coding-problems/for-class/:classId` (CodingController, auth-only, đặt trước `:id`)
  → `CodingService.listForClass` (ensure active member + lọc problem thuộc ClassCourse và (lessonId=null HOẶC
  LessonGate active); trả `CodingProblemSummary[]`, KHÔNG hidden/solution). Unit test: 403 non-member, rỗng khi
  chưa gán khóa, chỉ trả bài gated + không lộ field nội bộ.
- **FE**: `features/coding/api.ts` `listCodingProblemsForClass` + hooks student (`useCodingProblemsForClass`,
  `useCodingAttempt`, `useSubmitCoding`, `useCodingSubmission` polling 1.5s tới terminal). `pages/learn/LearnCoding.tsx`
  wired vào `LearnHome`: chọn lớp → list bài → mở workspace (Monaco editor + chạy sample bằng Pyodide worker
  preview + submit + poll → score + per-test). i18n vi/en `coding.*` bổ sung (open/back/sourceCode/previewNote/…).
- **Editor/Runner (theo yêu cầu install)**: `@monaco-editor/react`+`monaco-editor` (self-host `/monaco/vs` qua
  `vite-plugin-static-copy`, loader.config paths.vs — KHÔNG CDN); `pyodide` (self-host `/pyodide/*` — `pyodide.worker.js`
  dynamic import ESM `pyodide.mjs`, module worker). `vite.config.ts` copy asset. Pyodide npm mới versioning số lớn
  (`314.0.3` = latest chính thức pyodide/pyodide) — file `pyodide.asm.mjs` (ESM), không còn `.asm.js`.
- **Live e2e xanh**: student enrolled + lesson gated → for-class trả bài → Monaco tải 100% từ `/monaco/vs` (0 CDN) →
  Pyodide chạy sample 1/1 đạt in-browser → submit inline+stub → score 100 server-side, per-test sample+hidden.
  Regression: submission DTO KHÔNG có key stdin/expectedStdout; hidden expected KHÔNG lộ (actualStdout chỉ là output
  học viên — stub echo stdin chỉ là artifact dev).
- **Branch**: T3.4/T3.5/T3.7 (branch `codespace-p3-runner-queue`) đã **fast-forward** vào branch T3.8; cả P3 một branch.

### T3.4/T3.5 (runner + autograde) — 2026-08-14
- `apps/api/src/coding/runner/`: `RunnerService` interface (input trung lập: language/source/stdin/limits/stdoutCap →
  verdict ok|tle|mle|re|ce + stdout/stderr). `PistonRunnerAdapter` (env `CODE_RUNNER_URL/TOKEN`, POST `/api/v2/execute`,
  map SIGKILL→tle). `StubRunnerAdapter` (dev/smoke — **KHÔNG thực thi code**, echo stdin). `RunnerModule` chọn theo
  `CODE_RUNNER_PROVIDER` (mặc định stub — an toàn, không bao giờ chạy code in-process).
- `apps/api/src/coding/grading/AutograderService`: chấm **all-test (sample+hidden)** server-side qua runner (NGOÀI
  transaction), map verdict→TestCaseResultStatus, score = Σ(weight passed)/Σ(weight)*maxScore (**Decimal**, 2dp), lưu
  `TestCaseResult` upsert + update submission + `LessonProgress` (không hạ cấp completed) trong **CÙNG transaction**.
- `apps/api/src/coding/queue/`: `SubmissionQueue` port; `InlineSubmissionQueue` (chấm đồng bộ, mặc định, không Redis);
  `BullSubmissionQueue` (BullMQ, `REDIS_URL`, worker in-process concurrency 2, retry 2×backoff). Driver chọn ở
  `CodingQueueModule.register()` theo `CODE_QUEUE_DRIVER` (mặc định inline) — chỉ instantiate class được chọn.
- Endpoint (T3.5): `POST /coding-problems/:id/submissions` (không @RequirePermission — membership+gate trong service,
  tạo status=queued rồi enqueue) + `GET /coding-submissions/:id` (chủ sở hữu hoặc `coding.result.read` scoped theo
  `submission.classId` qua RbacService — route không có :classId). DTO submission KHÔNG lộ stdin/expectedStdout.
- **bullmq@6.1.0** đã cài (`pnpm add`). Env mới xem ACTIVE_TASKS §Env mới.
- **Live smoke e2e ✅ ALL GREEN** (inline+stub, DB 5433): course/section/lesson/problem/testcase(sample+hidden)/
  class/enroll/gate → student attempt (chỉ sample, không lộ hidden) → submit → autograde: status=failed,
  **score=25** (weighted 1/(1+3)·100 Decimal), 2 results (sample passed/hidden failed) chấm server-side,
  owner GET 200 / non-owner GET 403, không lộ stdin/expectedStdout. Boot API OK: DI resolve RunnerModule/
  CodingQueueModule, routes `POST /coding-problems/:id/submissions` + `GET /coding-submissions/:id` mapped.

### T3.7 (FE Teach coding) — 2026-08-14
- `apps/web/src/features/coding/` (api.ts + hooks.ts): author CRUD (list/get/create/update/delete problem,
  upsert/delete testcase) + **sẵn** student helpers (getCodingAttempt/submitCoding/getCodingSubmission) cho T3.8.
- `apps/web/src/pages/teach/TeachCoding.tsx`: course picker → form tạo problem (title/statement/lesson/difficulty/
  maxScore) + list → editor (statement + limits) + testcase manager tách **sample**/**hidden** (author XEM hidden
  expected — invariant #2 chỉ chặn surface student). Tab `coding` trong TeachHome; i18n vi/en (`coding.*`, đã gồm
  cả key cho T3.8 Learn: run/submit/status_*/tcstatus_*).
- Verified live (Vite 5173 proxy → API 3000): login GV → tab Coding render list "Echo", editor + sample(#0)/hidden(#1),
  form thêm test mở đúng. web typecheck + lint xanh.

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React + Vite + TailwindCSS + TanStack Query; Monaco editor + Pyodide (live code) |
| Backend | NestJS + Prisma ORM + PostgreSQL |
| Async/queue | Redis + BullMQ (chấm coding submission) |
| Code runner | Piston self-hosted cho P3 MVP, cách ly (services/code-runner); giữ adapter boundary để thêm Judge0 CE sau |
| Storage | `StorageAdapter` provider-agnostic: **Cloudflare R2** (file riêng tư, signed URL) + **Cloudinary** (media công khai). Local adapter cho dev. Cả hai free tier |
| Testing | Jest (unit) + Playwright (E2E) |

## Monorepo Structure (dự kiến)

```
apps/web        — frontend (frontend-only)
apps/api        — backend NestJS (backend-only)
packages/
  contracts/    — DTO/type/enum dùng chung FE↔BE (no logic)
  database/     — Prisma schema + migrations + generated client; export PrismaClient
services/
  code-runner/  — wrapper chạy code cách ly (Judge0/Piston)
```

## Working Areas (Stable)

- **Monorepo scaffold** (T0.0): pnpm@9.15.9 + Turborepo; `apps/api` (NestJS 10, health), `apps/web`
  (Vite 5 + React 18 + Tailwind 3 + TanStack Query), `packages/contracts` (dual CJS/ESM).
- **ESLint** flat config (ESLint 9 + typescript-eslint 8): base gốc `eslint.config.mjs` + config mỏng mỗi package.
- **Prisma + RBAC schema** (T0.1/T0.2): `packages/database` (Prisma 5.22, `@lms/database` export
  PrismaClient). 7 bảng: users, roles, permissions, role_permissions, user_roles, refresh_tokens,
  _prisma_migrations. Migration `init_identity_rbac` đã áp. `PrismaModule`/`PrismaService` @Global trong api.
- **Infra Docker**: `docker-compose.yml` (Postgres 16 + Redis 7). Publish **5433/6380** (né service native).
- **Auth** (T0.3/T0.4): module `auth` — JWT access (15m, Bearer) + refresh httpOnly cookie (SHA-256,
  rotation trong `$transaction`), bcryptjs, `JwtAuthGuard` + `@CurrentUser`, ConfigModule global.
  Contracts auth ở `@lms/contracts`. Guard export sẵn cho các module sau dùng lại.
- **PBAC** (T0.5): module `rbac` (@Global) — `RbacService` (quyền global + scope theo lớp),
  `@RequirePermission(...keys)`, `PermissionsGuard`. Dùng: `@UseGuards(JwtAuthGuard, PermissionsGuard)`
  + `@RequirePermission('x')`. classId lấy từ params→body→query cho chấm quyền theo lớp.
- **Users/RBAC CRUD** (T0.6): `GET/POST /users`, `GET/PATCH /users/:id`, `POST /users/:id/roles`,
  `DELETE /users/:id/roles/:roleKey`; `GET/POST /roles`, `POST /roles/:id/permissions`, `GET /permissions`.
  Catalog `PERMISSIONS` (8 key P0) ở `@lms/contracts`. Mapper ẩn passwordHash.
- **Seed** (T0.7): `packages/database/prisma/seed.cjs` idempotent — 8 permission, 5 role hệ thống, ma
  trận role→permission. Chạy: `pnpm --filter @lms/database seed` (tùy chọn `SEED_ADMIN_EMAIL` +
  `SEED_ADMIN_PASSWORD` để tạo super_admin đầu tiên; không hardcode secret).
- **FE shell** (T0.8): `apps/web` react-router-dom + react-i18next (vi/en). `lib/api` (access token
  in-memory + tự refresh 401 qua cookie), auth hooks, guards RequireAuth/RequireRoles, AppLayout,
  LoginPage, AdminHome (bảng /users), Teach/LearnHome. Routing theo vai `/admin /teach /learn`.
- **P1 schema + contracts** (T1.0/T1.1): 8 bảng courses/sections/lessons/classes/class_courses/
  class_members/lesson_gates/lesson_progress (migration `p1_course_class`). Contracts course/class +
  10 permission key mới (course.*, class.*).
- **Module `courses`** (T1.2): `apps/api/src/courses/` — CRUD Course/Section/Lesson + publish/archive.
  PBAC global (course.read/create/update/publish/delete). IDOR: section/lesson kiểm thuộc đúng
  course/section trong path (ensure*→404). Order auto max+1; trùng order→409; xóa course còn gán lớp→409.
  Mapper ẩn createdById. Đã wire vào `app.module`. Module `classes` (T1.3) chưa có.
- **Seed permission course/class** (T1.4, chỉnh ở T1.5): catalog **18 permission**; admin nhận đủ 10 key
  course/class; instructor nhận course.read/create/update/publish + class.read/**create**/update/manage
  (không delete — admin thu hồi). Idempotent (upsert): **43 liên kết**. TA/student chưa gán (scope/grade
  sau). `DATABASE_URL="...5433..." pnpm --filter @lms/database seed`.
- **Module `classes`** (T1.3): `apps/api/src/classes/` — route param `:classId` để `PermissionsGuard`
  chấm **scope theo lớp**. Class CRUD (class.create/read/update/delete) + `GET /classes/mine` (auth,
  lớp mình là member) + gán khóa/enroll (class.manage, enroll soft-remove+reactivate) + gate
  (`PUT :classId/gates` class.manage, ghi activatedBy/At, chặn bài ngoài khóa đã gán) + progress học
  viên (auth+membership, không permission key). **INVARIANT #3** enforced: progress→403 nếu chưa có gate
  isActive. Đã wire `app.module`. Bổ sung ở T1.5: `GET /classes/:classId/my-lessons` (auth+membership,
  chỉ bài đã gate + progress; contract `MyLessonDto`).
- **FE Teach/Learn** (T1.5): `apps/web` feature `courses` + `classes` (api+hooks TanStack Query).
  `TeachHome` tabs Khóa học (tạo/section/lesson/publish) + Lớp học (gán khóa/enroll/gate checkbox).
  `LearnHome`: chọn lớp (`/classes/mine`) → bài đã mở gate (`/my-lessons`) + cập nhật progress. i18n vi/en.
  ⚠️ Khu vực **`learn` mở cho mọi user đã đăng nhập** (`allowedAreas` luôn gồm learn; route learn bỏ
  RequireRoles) — vì HV enroll chưa có global role `student`; nội dung chặn theo membership ở BE.
- Lệnh: `pnpm db:up` (bật DB), `pnpm dev`, `pnpm validate`, `pnpm db:migrate`, `pnpm db:studio`.
- **DB dev**: seed T0.7 đã tạo đủ **5 role hệ thống + 8 permission** (super_admin=8, admin=7). Users
  dev: `admin@codespace.vn`/`Admin123!` (super_admin), `teacher@codespace.vn`/`Password123!` (instructor),
  `student1@codespace.vn` (chưa role). Dùng để test FE ở T0.8.

## Incomplete / Weak Areas

- **✅ Môi trường đã UNBLOCK.** Nguyên nhân "treo" trước đây KHÔNG phải ổ D: (D: là HDD + Defender chỉ
  làm *cold install* chậm, không treo). Thật ra: node_modules bị xoá + global store `D:\.pnpm-store\v3`
  **thiếu ~51 package**, `pnpm install` thường đi resolve registry trong sandbox bị kẹt, và `--offline`
  dựng cây **thiếu mà vẫn exit 0** (bẫy). **Cách repair khi node_modules hỏng/thiếu:** `pnpm install --force`
  (một lần, có mạng) — tải nốt phần thiếu + link lại đủ (mất ~9 phút trên HDD nhưng xong). Sau đó `pnpm validate` xanh.
- **🔎 Review code P2 (agent Gemini/Codex) — 2026-08-13:** đã soát `assignments` + `submissions` + seed
  + FE assessments + contracts P3.
  - ✅ **Đã fix 1 bug scope thật:** route `PUT /submissions/:id/grade` gắn `@RequirePermission(GRADE_WRITE)`
    nhưng route KHÔNG có `:classId` → `PermissionsGuard` chấm GRADE_WRITE ở **global**, chặn nhầm TA/GV
    được cấp quyền **scoped theo lớp** (seed cho `teaching_assistant` grade.write, TA gán role scoped)
    → 403 trước khi vào service. Đã **gỡ decorator** ở `submissions.controller.ts` (service đã tự kiểm
    scope đúng bằng `sub.classId`, giống `findOne`). ✅ Đã commit `ffee1c7`, validate xanh.
  - ✅ **Module `coding`** (T3.3, `apps/api/src/coding/`): CRUD problem/testcase (coding.read/create/update/
    delete + IDOR) trả **author DTO** (hidden+solution); student `GET /coding-problems/:id/attempt?classId=`
    (auth+membership+gate) trả **student DTO chỉ sample** — `toStudentDetail` filter kind='sample', KHÔNG
    solutionCode/hidden. Đây là ranh giới bảo mật P3, có unit test + smoke live giữ. Commit `0ad3cb6`.
  - 👍 Tốt: submissions enforce membership + gate (invariant #3) + IDOR (findOne) + Decimal + score≤maxScore
    + chặn sửa khi đã graded; contract `coding.ts` tách student-DTO (chỉ sample) vs author-DTO (hidden+solution).
  - Nợ nhỏ: FE `StudentAssignmentCard.tsx` còn vài chuỗi hardcode tiếng Việt (nên `t()`); `getMySubmission`
    chưa validate `classId` query; task board ghi T3.2 (schema coding) "not done" nhưng schema+migration
    `p3_coding_runner` đã có (uncommitted) — cần đồng bộ trạng thái.
- ⚠️ **Env files còn cổng 5432/6379 (cần sửa tay → 5433/6380).** `.env`, `.env.example`,
  `packages/database/.env` chưa đồng bộ cổng mới vì bị permission chặn ghi. Migration T0.2 chạy được
  nhờ truyền `DATABASE_URL` inline. Trước khi chạy `pnpm db:migrate` hay khởi động API, đổi
  `localhost:5432`→`localhost:5433` và `localhost:6379`→`localhost:6380` trong 3 file đó.
- **P1 ✅ DONE** (T1.0–T1.5, verify live). Kế tiếp **P2 Assessments** (chưa breakdown task).
- **Nợ nhỏ ghi nhận (không chặn P2)**: (a) FE quản lý gate/lesson hiện chỉ tạo (chưa sửa/xóa
  section/lesson/gán-khóa/enroll ở UI — backend đã có route DELETE); (b) enroll ở FE nhập `userId` thô
  (chưa tra theo email — cần endpoint tìm user hoặc student.read); (c) TA/student chưa có permission seed;
  (d) chưa E2E Playwright (mới verify tay).
- Data dev `student1` fullName lỗi encoding ("HV M?t") do curl smoke cũ — vô hại, tạo lại nếu cần.
- Code runner: đã chốt Piston self-hosted cho P3 MVP trong `docs/adr/001-code-runner-piston-mvp.md`; không dùng public Piston API mặc định.
- Chấm Scratch tự động: chưa có lời giải — giai đoạn đầu nộp + chấm tay (open question).
- Rule tự mở bài theo % lớp: ngưỡng & cơ chế kích hoạt chưa chốt.

## Critical Business Invariants

> Đề xuất chép vào `.harness/constraints/cx-hard-limits.md §DOMAIN` khi bắt đầu code.

1. **NEVER** chạy code học viên trong tiến trình API — luôn qua runner cách ly (no-network, giới hạn CPU/RAM/wall-time).
2. **NEVER** gửi `TestCase.kind=hidden` hoặc `QuestionOption.isCorrect` ra client khi đang làm bài.
3. **NEVER** cho học viên truy cập `Lesson` khi lớp chưa có `LessonGate` isActive=true.
4. **NEVER** hard-delete `Certificate`/`Submission`/`GradeEntry` — chỉ soft-delete/revoke.
5. **NEVER** tin điểm/kết quả client gửi lên (Pyodide) — luôn chấm lại ở server; điểm là `Decimal`.

## Role Rules

| Role | Access |
|---|---|
| `super_admin` | Toàn quyền + cấu hình hệ thống, quản lý role/permission |
| `admin` | Quản lý user/khóa học/lớp/chứng chỉ; KHÔNG đụng cấu hình hệ thống |
| `instructor` | Tạo/biên soạn khóa học, mở bài theo tiến độ lớp, chấm điểm, cấp chứng chỉ (lớp phụ trách) |
| `teaching_assistant` | Chấm bài + hỗ trợ lớp được phân công; KHÔNG sửa cấu trúc khóa học |
| `student` | Học bài, làm quiz/assignment/coding, xem điểm & chứng chỉ của mình |

RBAC = **PBAC**: guard kiểm `permission.key` (không kiểm role thô). Quyền như `grade.write` bị **giới hạn
theo phạm vi lớp** (`UserRole.classId` / `ClassMember.roleInClass`). Mọi route `:id` kiểm ownership ở service.

## Current Phase

**P1 — Course & Class ✅ DONE (6/6).** Kế tiếp: **P2 — Assessments** (assignment + submission + chấm
tay). Chi tiết & task breakdown → `.harness/agent/ACTIVE_TASKS.md`.

## Verification Commands

```bash
pnpm validate      # lint + type-check + test (chạy trước handoff)
npx prisma format && npx prisma validate
```
