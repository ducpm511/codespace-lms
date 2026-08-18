# Current State

<!-- SIZE LIMIT: 500 lines. Do not exceed. Refactor into specialized docs if approaching limit. -->

Updated: 2026-08-19

## Project Stage

**P0–P7 ✅ ALL PHASES DONE.**

### P7 Lesson Activities (2026-08-19) — branch `claude/handoff-p7-implementation-456432`, chưa merge main
- Bài học = **container activity có thứ tự** (markdown / pdf / video / quiz / coding / assignment).
  Đóng gốc bug user báo: FE trước chỉ gửi `title`, DTO đọc về không trả nội dung.
- Model `LessonActivity` + migration `p7_lesson_activities` (kèm data migration backfill từ
  `Lesson.contentMd/videoUrl` — DB dev 0 bản ghi legacy). `File.fileName` mới.
- Module `files` MỚI: `POST /files` (PDF, allowlist mime + **magic bytes** + 20MB ở multer lẫn service,
  storageKey server sinh) + `GET /files/:id` guard owner/`course.update`/member lớp có gate mở.
- `courses/lesson-activities.service.ts`: CRUD + reorder 2 pha (dải âm, né `@@unique([lessonId, order])`),
  IDOR course→section→lesson; gắn ref sẽ set `lessonId` cho engine để gate áp đúng; student đọc qua `my-lessons`.
- FE: `LessonActivityBuilder` (Teach) + render activities trong `LessonDetail` (Learn) + `.cx-prose` trong
  nocturne.css. `apiUpload` / `apiFetchObjectUrl` trong `lib/api` (iframe không gửi được Bearer → dùng blob URL).
- Bonus: `GET /assignments/for-class/:classId` (student-scope) — student không có `assignment.read`.
- **Verify**: `pnpm validate` 16/16 (api **174 test / 20 suite**), i18n parity **350/350**, prisma format+validate.
  Live: XSS markdown render thành text (không chạy script); video ngoài allowlist + `evil-youtube.com` → 400;
  upload PNG / PDF giả mime → 400; trước gate my-lessons rỗng + file 403; ngoài lớp 403; HV POST activity/files 403;
  quiz draft → refId/refTitle null. GV soạn + đảo thứ tự + xoá OK; HV xem đủ 6 loại đúng thứ tự.
- **⚠️ Phát hiện lỗi bảo mật P5 (KHÔNG do P7)** — xem `ACTIVE_TASKS.md §Nợ CHẶN`: `certificates`/`grading` đọc
  `currentUser.id` trong khi `@CurrentUser()` trả `{ userId }` → `getEffectivePermissions(undefined)` trả quyền
  của MỌI role; `listMine` lộ toàn bộ chứng chỉ; revoke/pdf IDOR mở; `my-gradebook` 500. Cần vá riêng.

### P0–P6 (trước đó)
- **P6 Polish & Gamification** đã hoàn tất:
  - **In-app Notifications**: Schema + contracts + module + triggers tự động trong cùng `$transaction` (`gate.opened`, `submission.graded`, `certificate.issued`, `certificate.revoked`, `badge.awarded`) + FE NotificationBell popover dropdown có unread badge và đọc tất cả.
  - **Real Gamification (ADR 002)**: Level, XP events, Streak liên tiếp, hệ thống huy hiệu (6 initial badges) được tính toán thật từ hoạt động học tập (lesson, quiz pass, coding pass) + FE `GreetingHero` và Streak pill liên kết API thật `/gamification/me`.
  - **PDF Certificate**: Tích hợp `pdf-lib` sinh file PDF chứng chỉ A4 landscape vàng/teal + lưu trữ qua `StorageAdapter` (`uploads/`) + endpoint tải file PDF `GET /certificates/:id/pdf`.
  - **Audit Log Viewer**: Endpoint `/audit` lọc theo actor/action/entity/date + Tab Nhật ký hệ thống ở AdminHome + modal JSON viewer.
  - **Teacher Class Report**: Endpoint `GET /classes/:id/report` + Tab Báo cáo & Thống kê ở TeachClasses (KPIs, phân phối điểm, tiến độ bài học).
  - **Lesson Discussions**: Module Comments (`GET/POST /lessons/:id/comments?classId=`) + component thảo luận ở `LearnHome > LessonDetail`.
  - **Teacher Authoring Tools**: Sửa/xóa Section & Lesson trong TeachCourses + Toggle Publish/Draft trắc nghiệm trong TeachQuiz.
  - **Security & Privacy Fix (D2)**: Gỡ bỏ `finalScore` khỏi QR verification công khai.
- **Quality Gates**: `pnpm validate` **16/16 tasks PASS** (API **18 test suites, 148 unit tests**; Web **4/4 unit tests** + Vite build production xanh; TypeScript typecheck 0 errors; ESLint 0 errors).

### P6 review & LOW fixes (2026-08-17)
- Review INVARIANTS P6 — **PASS toàn bộ**: gamification `recordLearningActivityInTx(tx)` trong cùng transaction
  + XpEvent idempotent (`@@unique`, sourceId ổn định) + GamificationModule wired vào cả 3 module trigger;
  notification tạo trong tx + scope theo user + markAsRead ownership; audit admin-only (`audit.read`);
  PDF `getPdfBuffer` chặn IDOR (owner/staff); quiz `for-class` lọc `published:true` (draft không lộ);
  comments scope membership; verify công khai bỏ `finalScore` (D2); template tách quyền `certificate.template.manage` (D3).
- **LOW fixes đã vá trong review**: (1) `LocalStorageAdapter` thêm `resolveKey` chặn path-traversal;
  (2) streak tính mốc "ngày" theo **giờ VN (UTC+7)** thay vì UTC; (3) `uploads/` vào `.gitignore`.
- Còn ghi nhận (không vá — systemic/infra): report/gradebook service không có defense-in-depth (dựa guard
  `class.read`/`grade.read`, student đã bị chặn); notification message hardcode tiếng Việt (chưa i18n server-side).

### P5 review & hardening (2026-08-16) — sau 2 vòng review
- Review INVARIANTS P5 phát hiện + ĐÃ VÁ (commit `a8d4f51` + `939a791`):
  - **H1** issue chứng chỉ: bắt buộc `classId`, gate **hoàn thành ≥80%** (đếm `LessonProgress` chỉ bài THUỘC
    course đó) + **finalScore ≥60%** lấy từ gradebook thật (bỏ default bịa 85).
  - **H2** sổ điểm quiz: `maxScore` = Σ `Question.points` (trước hardcode 100 → sai % weighted).
  - **H3** `GET gradebook` giờ **READ-ONLY** (không upsert); phần ghi tách sang `recomputeClassGradebook` +
    endpoint **`POST /classes/:classId/gradebook/recompute`** (staff). Học viên `my-gradebook` chỉ đọc, không
    kích hoạt ghi cho cả lớp. `certificates.issue()` gọi recompute để finalScore tươi. FE Teach gọi recompute khi mở sổ.
  - **H4** quyền riêng tư: bỏ `grade.read`/`certificate.read` khỏi role **student** (seed); `getClassGradebook`
    kiểm caller là admin/scoped-grade.read/instructor|ta của lớp (không còn bỏ qua `currentUser`).
  - **M1** revoke: bỏ `@RequirePermission` global (route không có `:classId`) → service tự scope theo `cert.classId`.
  - **M2** `serialNo`/`verificationCode` dùng `crypto.randomBytes` + retry P2002 (thay `Math.random`).
  - **M3** FE `VerifyCertificate.tsx` chuyển sang token Nocturne/`cx-*`.
- Còn lại (nợ nhỏ, không chặn — xem `ACTIVE_TASKS.md §Nợ kỹ thuật`): L2 verify lộ thừa `finalScore`; L3
  `createTemplate` dùng chung quyền issue; PDF chứng chỉ chưa sinh (`pdfFileId` null).

### Playful/gamified redesign (apps/web toàn bộ) — 2026-08-16
- Áp bộ design handoff MỚI "Playful redesign" (`apps/web/design_handoff_lms_ui/`, README "The playful layer")
  LÊN TRÊN nền Nocturne flat. Đây là refresh **styling + layout + IA**, GIỮ NGUYÊN hooks/routing/i18n keys.
- **Nền playful** (`src/styles/nocturne.css`, append cuối): category tokens `--cx-purple/amber/teal/coral/blue`
  + `--cx-radius:22px`; body ambient radial-glow; font **Baloo 2** (`.cx-display`, thêm vào Google Fonts import);
  pill primary buttons (999px); motion utils `.cx-tile/.cx-lift/.cx-press/.cx-float/.cx-bob/.cx-shooting-star/
  .cx-blob/.cx-dots` + `@keyframes cx-pop/float/bob/shoot` (gate sau `prefers-reduced-motion`); `.cx-toggle`
  switch 34×20 (label>input+`.cx-toggle-thumb`, dùng `:has`). **Phosphor icons**: cài `@phosphor-icons/web`
  (import `/regular`+`/fill` ở `main.tsx`), dùng `<i className="ph|ph-fill ph-*">`.
- **Màn đổi**: AppLayout (sticky+blur nav, tab pill có icon, streak pill mock, avatar gradient purple→coral);
  LoginPage (shooting stars + blobs + mascot-laptop `.cx-float` + rocket); **LearnHome IA MỚI** (greeting hero
  stats+level ring+mascot — gamification MOCK; class seg; celebration banner; continue card % thật; "Bài học"
  GROUP THEO CHƯƠNG collapse + "Xem thêm N bài" [`collapsedChapters`/`expandedChapters` theo sectionTitle];
  "Bài tập" HUB gộp quiz+coding + filter seg; lesson detail view openId — media theo type + placeholder
  content/discussion [my-lessons API chưa trả body]); LearnQuiz (result `.cx-pop` + mascot + đánh dấu pick
  đúng→`ph-check-circle` accent-300 / sai→`ph-x-circle`); LearnCoding (chrome sticker traffic-lights, giữ Monaco/
  Pyodide); TeachHome (h1 cx-display + tab icon); TeachClasses (class card icon tile + gate `.cx-toggle`);
  TeachQuiz (publish `.cx-toggle` **PLACEHOLDER disabled** — Quiz chưa có field `published`, việc BE); Admin
  (toolbar search client-side + table).
- **Refactor**: `LearnQuiz.tsx`→export `LearnQuizWorkspace`, `LearnCoding.tsx`→export `LearnCodingWorkspace`
  (LearnHome tự sở hữu list/hub). Bỏ section ClassAssignments cũ khỏi Learn (đúng IA mới, xoá luôn nợ 403 /assignments).
- **INVARIANT giữ**: verified live payload `GET /quizzes/:id/attempt` KHÔNG có isCorrect/correctAnswer; UI khi
  đang làm 0 annotation; chỉ hiện đúng/sai sau nộp từ `QuizAttemptDto.answers[]`.
- **Verify**: web typecheck/lint(0 error, 1 warning cũ)/build xanh; **`pnpm validate` 16/16**; i18n parity vi/en
  **309/309**; live smoke MỌI màn (login/nav/Learn hero+chapter+hub+lesson-detail+quiz nộp 2/2/Teach 5 tab/Admin
  search) render Baloo 2 + Phosphor + cx-toggle đúng. **Nợ BE ghi nhận**: Quiz.published (publish toggle),
  discussion/comment API, gamification streak/XP/badge/level (đang MOCK tĩnh). CSS bundle 152kB (gzip 29.7kB) do
  Phosphor web-font ship full icon CSS — cân nhắc `@phosphor-icons/react` tree-shake nếu cần giảm.
- **Branch**: `claude/playful-redesign-web-f80264`. Chưa merge main (chờ user quyết định).

### Full Nocturne re-skin (toàn bộ trang) — 2026-08-15
- Theo yêu cầu user (trước P5): áp Nocturne cho MỌI màn (không chỉ quiz). Commit `806f3a8`, **đã MERGE
  vào main** (local FF, main ở `88f43d5`, chưa push origin).
- `nocturne.css`: bật ground TOÀN CỤC (`body` dark + `h1..h6` Inter + `a` accent) → màn mới không cần bọc
  `.nocturne-surface`. Thêm helper `.panel/.panel-head/.chip/.nav-active`.
- Đổi: AppLayout (nav logo + active accent + avatar initials), LoginPage (2-cột banner+mascot-laptop),
  AdminHome (.panel+.table+tag), TeachHome (tabs→.seg), Teach Courses/Classes/Assignments/Coding,
  LearnHome (greeting eyebrow + class seg + lesson cards/tags), LearnCoding (Monaco `vs-dark` + tag pills),
  StudentAssignmentCard. i18n thêm login.banner*/footer + learn.greeting/lessonsHeading.
- Verify: web typecheck/lint/build xanh (CSS purge còn 21.3kB); browser mọi màn (login/nav/teach 5 tab/learn/
  admin) render Nocturne, lượt sạch request 200. Không còn màn light-slate.

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

**P7 — Lesson Activities ✅ DONE (T7.0–T7.6).** Kế tiếp ưu tiên: **vá lỗi bảo mật P5**
(`ACTIVE_TASKS.md §Nợ CHẶN` — `currentUser.id` undefined ở certificates/grading). Chi tiết & task breakdown →
`.harness/agent/ACTIVE_TASKS.md`.

### Gotchas môi trường thêm ở P7
- Chạy trong **git worktree**: `pnpm db:up` sẽ FAIL (`docker compose` dùng tên project theo thư mục nhưng
  container `lms-postgres`/`lms-redis` đã tồn tại từ worktree chính) → dùng `docker start lms-postgres lms-redis`.
- `prisma generate` (trong `pnpm validate` → `@lms/database build`) **EPERM** khi API dev đang chạy — TẮT API
  trước khi validate: `netstat -ano | grep :3000` → `taskkill //PID <pid> //F`.
- `admin@codespace.vn` KHÔNG dùng được mật khẩu `Admin123!` trên DB dev hiện tại. Fixture P7 đã thêm 2 học viên
  test: `p7member@codespace.vn` (member lớp có gate) / `p7outsider@codespace.vn` (ngoài lớp), mật khẩu `Learn123!`.
- Screenshot của Browser pane timeout khi pane ẩn → dùng `get_page_text`/`read_page`/`javascript_tool`.

## Verification Commands

```bash
pnpm validate      # lint + type-check + test (chạy trước handoff)
npx prisma format && npx prisma validate
```
