# Archive — chi tiết triển khai P3 (Coding & Runner) và P4 (Quiz)

Tách khỏi `.harness/agent/CURRENT_STATE.md` khi file chạm giới hạn 500 dòng
(`cx-scope-guards.md`). Nội dung giữ nguyên, chỉ đổi chỗ. Trạng thái hiện tại của hệ thống
nằm ở `CURRENT_STATE.md`; đây là ghi chép lịch sử để tra khi cần debug.

### T4.6 (FE Learn quiz) — 2026-08-14
- `apps/web/src/pages/learn/LearnQuiz.tsx` (Nocturne `.nocturne-surface`, wired vào `LearnHome` sau ClassAssignments,
  trước LearnCoding). List quiz theo lớp (`useQuizzesForClass`) → `QuizWorkspace` (openId pattern): `useQuizAttempt`
  (student DTO — KHÔNG đáp án) render 5 loại câu hỏi (single/true_false = `.radio`, multiple = `.checkbox`, short_answer
  = input, code_fill = textarea). Local answers state → `useSubmitQuizAttempt` (`POST :id/attempts`, nộp+chấm 1 lần) →
  `QuizResult`: score/maxScore + mascot (hearts đạt / grumpy chưa đạt) + tag đạt/chưa (score ≥ passScore) + per-question
  Đúng/Sai + awardedPoints/points từ `attempt.answers[].isCorrect`. **KHÔNG render đáp án đúng** (invariant). "Làm lại"
  reset answers + result + `submit.reset()`. 403 hết lượt → `ApiError.status===403` → `quiz.attemptsExhausted`.
- Build/submit payload: chỉ gửi câu đã trả lời (choice có selectedOptionIds, text có textAnswer.trim()); server chấm
  câu thiếu = 0.
- **Live e2e student xanh**: student mới (enroll lớp KQ, course QuizFull) → quiz lessonId=null hiện for-class → làm 3 câu
  (single Hà Nội + multi {2,4} + short "5") → nộp → **score 4/4 chấm server-side, Đạt**, per-question Đúng 1/1·2/2·1/1;
  "Làm lại" reset OK. **Regression xanh**: `GET :id/attempt` payload KHÔNG chứa `isCorrect`/`correctAnswer` (verified
  API + UI); result chỉ hiện Đúng/Sai + điểm, không lộ đáp án.
- Ghi nhận (pre-existing, KHÔNG do quiz): `LearnHome > ClassAssignments` gọi `GET /assignments` → 403 với student
  không có `assignment.read` (console 403). Nợ nhỏ của LearnHome, nên đổi sang endpoint student-scope sau.

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
