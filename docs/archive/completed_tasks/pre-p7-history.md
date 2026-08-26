# Lịch sử CURRENT_STATE — giai đoạn trước P7

<!-- Tách khỏi .harness/agent/CURRENT_STATE.md ngày 2026-08-26 vì file đó chạm trần 500 dòng. -->
<!-- CHỈ ĐỌC KHI CẦN TRA LẠI. Không phải context bắt buộc của session. -->

Các mục dưới đây từng nằm trong `CURRENT_STATE.md`. Chúng mô tả những việc đã HOÀN THÀNH và ổn
định từ lâu — giữ lại để tra cứu, không cần nạp vào mỗi session.

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
