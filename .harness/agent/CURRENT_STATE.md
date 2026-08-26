# Current State

<!-- SIZE LIMIT: 500 lines. Do not exceed. Refactor into specialized docs if approaching limit. -->

Updated: 2026-08-26

## Project Stage

**P0–P9 ✅ ALL PHASES DONE.** Hệ thống đã đóng gói được để chạy thật trên 1 VPS;
chưa deploy lên máy thật (chưa mua VPS, chưa có tài khoản Cloudinary).

### P10 · T10.1 Bảng xếp hạng lớp theo tuần (2026-08-26)

- **`XpEvent.classId` nullable + FK `SetNull` + index `(classId, createdAt)`.** Chọn thêm cột thay vì suy
  từ `sourceId` lúc đọc: suy lúc đọc phải join 3 bảng khác nhau cho 3 nguồn XP và vẫn sai khi học viên
  học cùng bài ở nhiều lớp. Migration `20260826090000_p10_xp_class_scope` backfill từ chính sự kiện domain
  (`lesson_progress` / `quiz_attempts` / `coding_submissions`), chọn bản ghi gần thời điểm cộng XP nhất;
  suy không ra thì để NULL và bảng xếp hạng bỏ qua — **không đoán bừa**.
- **Khoá `(userId, source, sourceId)` giữ nguyên**, nên học lại cùng bài ở lớp khác KHÔNG cộng XP lần hai
  và `classId` giữ lớp đầu tiên. Cố ý: nới ra là mở đường farm điểm (HANDOFF_P10 §Cảnh báo).
- **`GET /classes/:classId/leaderboard?week=current|previous`.** KHÔNG gắn `@RequirePermission` — `class.read`
  là quyền của GV/admin, gắn vào thì chính học viên không xem được bảng của lớp mình. Quyền kiểm ở service
  (`ensureCanViewClass`): thành viên `active`, HOẶC `class.read` **scope đúng lớp đó** (INVARIANT #3).
- **Mốc tuần = thứ Hai 00:00 giờ VN = CN 17:00 UTC** (`weekWindowVn`, dùng chung `APP_TZ_OFFSET_MS` với streak).
  Reset hằng tuần là chủ ý: bảng tích luỹ vĩnh viễn thì em vào sau không bao giờ đuổi kịp.
- Chỉ xếp hạng `roleInClass = student` đang `active` (GV/TA đứng ngoài). Học viên 0 điểm vẫn có mặt để tự
  thấy hạng của mình. Đồng điểm → đồng hạng (1, 1, 3). Chỉ số hiển thị là **số bài hoàn thành**, không phải
  điểm/tốc độ. FE `pages/learn/ClassLeaderboard.tsx` mặc định chỉ hiện tốp 10 + dòng của chính mình.
- `useUpdateProgress` giờ invalidate cả `gamification/me` và leaderboard — trước đó hero XP đứng yên tới 60 s
  sau khi hoàn thành bài.
- `pnpm validate` 16/16 (api **299 test / 27 suite**), i18n parity **533/533**.
  **Chưa chạy migration trên DB thật** (worktree không có Postgres/Docker) và chưa thử qua giao diện.

### P9 Production readiness (2026-08-21) — branch `claude/p9-single-vps-deployment-882cf5`, chưa merge main

- **T9.0 Khởi động an toàn.** `apps/api/src/config/env.validation.ts` chạy trong `ConfigModule.validate`:
  thiếu/sai biến -> throw -> API CHẾT lúc boot kèm danh sách đủ các vấn đề (đã kiểm chứng bằng cách chạy
  `dist/main.js` với env rỗng và trong container). Production còn bắt buộc `WEB_ORIGIN`, hai JWT secret
  KHÁC nhau và ≥32 ký tự, và **chặn `CODE_RUNNER_PROVIDER=stub`** (stub không chạy code thật -> chấm giả).
  Giá trị driver luôn được kiểm enum: gõ sai `pistion` sẽ crash thay vì âm thầm rơi về stub.
  Thêm `helmet`, `app.set('trust proxy', 1)` ở production, `AllExceptionsFilter` (5xx trả message chung,
  stack chỉ vào log — INVARIANT #7).
- **Rate limit khoá theo DANH TÍNH, không theo IP** (`common/throttling/auth-throttle.ts`): cả lớp ngồi
  sau NAT của trường chỉ có 1 IP, khoá theo IP là chặn oan cả lớp. `login` khoá theo (IP, email),
  `refresh` theo băm SHA-256 của chính refresh token, `change-password` theo access token của người gọi.
  5 lượt/phút + khoá thêm 5 phút. Trần chung mọi route: `RATE_LIMIT_PER_MINUTE` (mặc định 600), `/health` miễn.
  Kiểm chứng live: 5 lần sai -> lần 6 trả 429, tài khoản khác cùng IP vẫn 401 (không bị chặn lây).
- **T9.1 Quản trị user trên UI.** `AdminHome` từ chỉ-đọc thành đủ tạo/sửa/gán-gỡ role + tìm kiếm, lọc
  trạng thái/vai trò và phân trang **ở server** (trước đây nạp cứng 20 bản ghi rồi lọc ở client nên
  không bao giờ tìm được người thứ 21). `features/users/{api,hooks}.ts` mới; ô tìm kiếm có debounce.
- **T9.2 Vòng đời mật khẩu.** `POST /auth/change-password` (tự phục vụ, kiểm mật khẩu cũ) và
  `POST /users/:id/reset-password` (quyền `user.update`). Cả hai đi qua `AuthService.setPassword`:
  đổi hash + thu hồi **toàn bộ** refresh token + ghi AuditLog trong CÙNG transaction (INVARIANT #6).
  Kiểm chứng live: mật khẩu cũ 401, mật khẩu mới 201, cho cả hai đường.
- **AuditLog cho toàn bộ khu quản trị**: `user.create` / `user.update` / `role.assign` / `role.revoke`
  ghi trong cùng transaction với thay đổi dữ liệu. Gán lại role đã có -> KHÔNG ghi audit thừa.
  metaJson không chứa mật khẩu hay email (INVARIANT #5).
- **T9.3 Cloudinary storage.** `STORAGE_DRIVER=local|cloudinary`; adapter upload `resource_type: 'raw'` +
  `type: 'authenticated'`, KHÔNG trả `secure_url` ra ngoài, đọc qua URL có chữ ký ở phía server. File vẫn
  chỉ tới học viên qua `GET /files/:id` sau `ensureCanRead` (HANDOFF_P9 §A). `StorageAdapter.provider` mới
  -> `File.provider` ghi đúng nơi chứa bytes thay vì hằng `'local'`. **Chưa xác minh với tài khoản thật.**
- **T9.4 Gộp query.** `GET /teach/overview` trả tổng cho hero + số liệu từng lớp cho sidebar trong
  **6 truy vấn cố định**, thay cho N request `/classes/:id/report`. Đếm hoàn thành bằng MỘT `groupBy` với
  `OR` từng lớp (ràng đúng học viên + đúng bài đã mở gate) — đếm thô theo classId sẽ vọt quá 100%.
  Tiến độ chung tính trên TỔNG lượt hoàn thành, không phải trung bình các tỉ lệ. Chip thứ 3 của hero giờ
  đúng là **"Chờ chấm"** theo design §7.
- **T9.5/T9.6 Đóng gói & vận hành.** Dockerfile cho api + web(Caddy), `docker-compose.prod.yml`
  (2 network tách Piston khỏi Postgres, không map port ra host, mem_limit từng service), `ops/Caddyfile`
  (nén + `immutable` cho `/assets` `/monaco` `/pyodide`), `ops/{bootstrap-vps,deploy,backup,restore}.sh`,
  CI GitHub Actions (`pnpm validate` + i18n parity), `docs/RUNBOOK.md`.
  **Đã build và chạy thật cả hai ảnh** để kiểm chứng: api healthy, `migrate deploy` chạy được từ trong ảnh,
  qua Caddy thì `/api/health` proxy đúng, asset có hash trả `immutable` + gzip, route SPA sâu trả index.html.

#### Bẫy đã gặp khi dựng ảnh (đừng mất công tìm lại)
- `prisma generate` chọn query engine theo phiên bản OpenSSL **dò được lúc build**. Không cài `openssl`
  ở stage build thì nó sinh engine `debian-openssl-1.1.x` trong khi runtime là `3.0.x` -> app chết lúc
  khởi động với "could not locate the Query Engine".
- Phải `COPY --chown=node:node`, nếu không Prisma CLI không ghi được vào thư mục engine của chính nó
  và `migrate deploy` hỏng đúng ở bước release.
- `pnpm install --filter "@lms/api..."` để monaco/pyodide của web không lọt vào ảnh API (751 MB -> 544 MB).
- `prisma` chuyển từ devDependency sang dependency của `@lms/database` để còn lại sau `pnpm prune --prod`.

#### Vá lỗi có sẵn phát hiện trong lúc verify (không do P9)
- Tab **Nhật ký hệ thống** chưa từng chạy: FE gọi `/audit` còn controller phục vụ `/audit-logs`, và gửi
  `from`/`to` trong khi DTO khai `fromDate`/`toDate`. `AuditFilters` giờ chính là `AuditLogFilterQuery`
  dùng chung để hai bên không lệch nhau nữa.
- `File.fileName` mojibake của bản ghi cũ: `packages/database/scripts/fix-file-name-mojibake.mjs`
  (chỉ sửa khi round-trip latin1<->utf8 khớp tuyệt đối nên không phá tên đang đúng). Đã chạy trên DB dev:
  3/6 bản ghi được sửa, chạy lần hai báo không còn gì.

### P8 Teach redesign (2026-08-19) — ✅ DONE
Chi tiết ở `ACTIVE_TASKS.md §Phase P8`. Nợ FE của P8 đã trả hết trong P9:
`useUpdateClass` + dialog "Cài đặt lớp", gỡ khóa khỏi lớp, `useUpdateAssignment` + dialog "Sửa bài tập"
(`useUpdateCodingProblem` hoá ra đã có sẵn từ P8). Tab **Trắc nghiệm** và **Sổ điểm & Chứng chỉ** đã smoke
live lần đầu — cả hai nạp dữ liệu bình thường, console sạch.

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
### Vá lỗi bảo mật P5 (2026-08-19) — phát hiện khi verify P7, KHÔNG do P7
- Gốc: `@CurrentUser()` trả `AuthPrincipal { userId }` nhưng `certificates`/`grading` khai kiểu `AuthUser` rồi đọc
  `currentUser.id`/`.roles` → undefined. `getEffectivePermissions(undefined)` → Prisma bỏ qua filter → trả quyền
  của **MỌI role** (≈ super_admin); `listMine` lộ toàn bộ chứng chỉ; revoke/pdf IDOR mở; `my-gradebook` 500.
- Vá: 2 service dùng `AuthPrincipal.userId`, bỏ shortcut role thô (admin nhận quyền GLOBAL nên `hasPermission`
  phủ đủ — đã đối chiếu seed), `getEffectivePermissions` trả RỖNG khi `userId` falsy (phòng thủ chiều sâu).
  api **180 test** (+6 hồi quy). Live: my-gradebook 200; HV không sở hữu → `/certificates/mine` 0, `:id/pdf` 403,
  `:id/revoke` 403; GV vẫn 200. Chi tiết → `ACTIVE_TASKS.md`.
### Vá PDF chứng chỉ tiếng Việt (2026-08-19) — lỗi P6/D1, cũng không do P7
- Trước: `GET /certificates/:id/pdf` **500** `WinAnsi cannot encode "ơ"` — `pdf-lib` StandardFonts (Helvetica)
  mã hóa WinAnsi, không có ký tự có dấu. Nhãn tĩnh trong generator từng phải bỏ dấu để né lỗi.
- Vá: nhúng **Roboto** (Apache-2.0) qua `@pdf-lib/fontkit` + `embedFont(..., { subset: true })`.
  Font lấy từ npm `roboto-fontface` (định dạng **WOFF** — `@pdf-lib/fontkit` đọc thẳng), nạp bằng
  `require.resolve` + cache buffer module scope → **không commit binary, không cần copy asset ở `nest build`**.
  Nhãn tĩnh khôi phục dấu đầy đủ.
- Verify: api **183 test** (+3), `pnpm validate` 16/16. `fontkit.layout()` cho **0 `.notdef`** trên mọi chuỗi
  thật (không tofu). Live: 200 `application/pdf` ~18KB cho GV có quyền và chủ sở hữu.

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

### P3 (Coding & Runner) + P4 (Quiz) — chi tiết đã tách ra

Ghi chép triển khai từng task T3.x/T4.x: `docs/archive/current-state-p3-p4.md`.
Cả hai phase ✅ DONE; đọc archive chỉ khi cần tra lịch sử.

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

**ĐÃ DEPLOY THẬT — https://lms.codespace.edu.vn đang chạy** (VPS TINO `103.142.27.54`).
Trạng thái production, việc còn lại trước khi mở lớp, và bẫy đã gặp: **`.harness/agent/HANDOFF_P10.md`**.

**P10 đang chạy.** T10.1 ✅ (xem mục trên). Tiếp theo: T10.3 (GV trao thưởng) → T10.2 → T10.4.
T10.5 vẫn **chặn** cho tới khi có người chốt 2 quyết định ở HANDOFF_P10 §T10.5 (H4).

### Gotchas môi trường thêm ở P9
- Worktree KHÔNG có `.env` (file này gitignored, chỉ nằm ở checkout chính). Kể từ P9, API **chết ngay**
  khi thiếu env thay vì chạy nửa vời — tạo `.env` cục bộ trong worktree theo `.env.example` trước khi dev.
- `.claude/settings.json` từng deny `Read(./.env.*)` nên chặn luôn `.env.example` (file chỉ chứa giá trị giả).
  Đã thu hẹp còn `.env`, `.env.local`, `.env.*.local`, `.env.production`.
- Tài khoản dev tạo trong P9: `p9-admin@codespace.local` (super_admin + instructor). Mật khẩu chỉ nằm ở
  `.env` cục bộ, không ghi vào repo.
- `docker compose -f docker-compose.prod.yml config` cần `--env-file` hoặc biến shell, nếu không nó báo
  thiếu `.env.production`.

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
