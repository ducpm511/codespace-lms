# HANDOFF — P6 Polish + dọn nợ kỹ thuật

> Prompt sẵn-để-dán cho session mới. Copy toàn bộ khối dưới vào session P6.

## 🔒 Quyết định đã chốt (KHÔNG hỏi lại)
1. **PDF chứng chỉ**: dùng **`pdf-lib`** (nhẹ, không headless). KHÔNG puppeteer.
2. **Gamification**: **LÀM THẬT** (không giữ mock) — streak / XP / badge / level có backend + tính từ hoạt động học.

---

````
Bạn tiếp nhận dự án CodeSpace LMS (monorepo pnpm: apps/api NestJS+Prisma, apps/web
React+Vite+Tailwind+TanStack Query+react-i18next). ĐỌC `AGENTS.md` ở root TRƯỚC (entry point mọi
agent) rồi chạy Default Startup Sequence: đọc `.harness/agent/CURRENT_STATE.md` +
`.harness/agent/ACTIVE_TASKS.md` + MEMORY.md (đặc biệt memory `fe-nocturne-design` khi đụng FE
apps/web — toàn app đã re-skin "Playful redesign" trên nền Nocturne, PHẢI bám token/`cx-*`, đừng tự chế
style). Giao tiếp tiếng Việt; code/identifier/commit tiếng Anh.

## QUYẾT ĐỊNH ĐÃ CHỐT (user đã duyệt — KHÔNG hỏi lại)
- PDF chứng chỉ dùng **pdf-lib**. Gamification **làm thật** (có backend).

## VỊ TRÍ HIỆN TẠI (nền để build LÊN TRÊN)
- **P0–P5 ✅ DONE** + **Playful redesign FE ✅ DONE**, tất cả trên `main` **local** (commit `1e9c1a7`,
  CHƯA push origin). P5 (Gradebook & Certificate) đã qua 2 vòng review, đóng hết H1–H4/M1–M3.
- `pnpm validate` xanh **16/16** (api **140 test**, web 4). Docker Postgres :5433 / Redis :6380 đang chạy.
- Chi tiết: `CURRENT_STATE.md §P5 review & hardening` + `ACTIVE_TASKS.md §Nợ kỹ thuật`.
- Model đã có: `AuditLog` (P5 ghi rồi). CHƯA có: `Notification`, `File`, `Quiz.published`, model gamification.

## NHIỆM VỤ: P6 — Polish + gamification thật + dọn nợ kỹ thuật
Đọc `docs/DESIGN.md` §4.8 (Notification/File/AuditLog), §5.3–5.4 (chứng chỉ + storage), §10 (roadmap P6).
Đi đúng thứ tự: `contracts → prisma schema → backend → frontend`. Bám pattern module có sẵn
(`grading`/`certificates`/`quiz`). Ghi domain + `AuditLog`/notification CÙNG transaction. PBAC scope theo lớp.

### A. P6 Polish
- **T6.0 Notification** — model `Notification(id, userId, type, payloadJson, readAt?, createdAt)` (mới). schema
  + contracts + module `apps/api/src/notifications/`: tạo notification khi có sự kiện domain (cấp/thu hồi
  chứng chỉ, bài nộp được chấm, mở gate…) ghi CÙNG transaction với hành động gốc. Endpoints `GET /notifications`
  + `POST /notifications/:id/read` + `POST /notifications/read-all`. FE: **chuông ở nav đã có placeholder**
  (`AppLayout.tsx`, nút `ph-bell`) → wire dropdown + badge số chưa đọc.
- **T6.1 Audit UI** — `AuditLog` đã ghi sẵn. Thêm quyền `audit.read` (seed admin) + `GET /audit-logs`
  (admin, filter entity/actor/ngày, phân trang) + FE Quản trị bảng `.table` xem log.
- **T6.2 Báo cáo/thống kê** — thống kê lớp (tỉ lệ hoàn thành, điểm TB, số chứng chỉ) — suy ra từ gradebook
  (`recomputeClassGradebook`) + certificates. FE Teach: tab/section "Báo cáo".

### B. Gamification THẬT (thay mock ở LearnHome hero) — greenfield, cần ADR
Hiện `LearnHome.tsx > GreetingHero` hardcode `const MOCK = {streak, xp, badges, level, ringTurn}`. Thay bằng data thật.
- **Không có trong DESIGN** → ghi ADR `docs/adr/00x-gamification.md` chốt mô hình + con số (hỏi user duyệt bảng
  điểm XP nếu cần). Mô hình ĐỀ XUẤT (tối thiểu, làm được ngay):
  - **XP**: bảng `XpEvent(id, userId, source[lesson_complete/quiz_pass/coding_pass], sourceId, amount, createdAt)`
    (append-only, idempotent theo `@@unique[userId, source, sourceId]` để không cộng trùng). Ghi trong CÙNG
    transaction với `LessonProgress`/quiz submit/coding autograde (nơi đã có transaction sẵn). XP tổng = Σ amount.
  - **Level**: suy từ XP tổng theo ngưỡng (hàm thuần, vd mỗi 500 XP = 1 level) — KHÔNG lưu cột riêng.
  - **Streak**: `UserStreak(userId @unique, current, longest, lastActiveDate)` — cập nhật khi có hoạt động học
    trong ngày (so `lastActiveDate`: hôm qua→+1, hôm nay→giữ, cách quãng→reset 1).
  - **Badge**: `Badge(id, code @unique, name, description, criteriaJson)` + `UserBadge(userId, badgeId, awardedAt)`
    `@@unique[userId, badgeId]`. Trao khi đạt mốc (vd first_lesson, 7day_streak, quiz_master). Seed vài badge.
  - Endpoint `GET /me/gamification` (hoặc `/classes/:classId/my-gamification`) trả `{streak, xp, level, badges[]}`.
  - FE: hook `useMyGamification()` → thay `MOCK` trong `GreetingHero`; streak pill ở `AppLayout` (đang hardcode "5")
    cũng dùng data thật.
- Điểm/level tính **server-side**, không tin client.

### C. Nợ kỹ thuật (ưu tiên theo thứ tự)
**Quick wins:**
- **D1 `Quiz.published`** — thêm field `published Boolean @default(false)` vào Quiz + contract + endpoint update
  (`useUpdateQuiz` field `published`). Wire publish toggle **đang PLACEHOLDER disabled** ở `TeachQuiz.tsx`.
  **QUAN TRỌNG**: `GET /quizzes/for-class/:classId` lọc CHỈ `published=true` cho học viên (draft không lộ).
- **D2 (P5 L2)** — bỏ `finalScore` khỏi `PublicVerificationDto` + trang `/verify/:code` (DESIGN §5.3 chỉ tên/khóa/ngày).
- **D3 (P5 L3)** — tách quyền `certificate.template.manage` (admin) khỏi `certificate.issue` cho `createTemplate`.

**Lớn hơn:**
- **D4 PDF chứng chỉ (pdf-lib)** — model `File` (§4.8) + `StorageAdapter` (local dev / R2 private §5.4) + sinh PDF
  bằng **pdf-lib** khi issue → set `Certificate.pdfFileId` + FE nút tải PDF qua signed URL. Ghi ADR runner/storage.
- **D5 Discussion/comment** (lesson detail, đang placeholder ở `LearnHome.tsx > LessonDetail`) — model comment + API nếu làm.
- **D6 FE gaps P1** — sửa/xóa section/lesson ở UI (backend đã có DELETE); enroll theo email (thay nhập `userId` thô).

### RÀNG BUỘC BẤT BIẾN
- Ghi domain + `AuditLog`/notification/XpEvent trong **CÙNG transaction**. KHÔNG hard-delete
  `Certificate`/`Submission`/`GradeEntry`/`QuizAttempt`.
- Điểm/XP/level chấm **server-side** (`Decimal` cho điểm), KHÔNG tin client. Quiz đang làm KHÔNG lộ
  `isCorrect`/`correctAnswer`; quiz `draft` KHÔNG lộ cho học viên (D1).
- **PBAC scope theo lớp**; route `:id` kiểm ownership/scope ở service (đừng dựa mình vào guard khi route thiếu
  `:classId` — bài học P2/M1). PII: `/verify/:code` public không lộ nhạy cảm; PDF ở private storage + signed URL.
- FE bám token Nocturne + `cx-*` (memory `fe-nocturne-design`), KHÔNG raw Tailwind slate/purple.

### MÔI TRƯỜNG / GOTCHAS
- Docker Postgres :5433 / Redis :6380 (KHÔNG 5432/6379). `docker ps`; `pnpm db:up` nếu tắt.
- Đụng contracts → `pnpm --filter @lms/contracts build` TRƯỚC `db:generate`/`migrate`/`seed` (else PERMISSIONS.* undefined → seed nổ).
- `.env` permission-deny → truyền env INLINE. API dev (port 3000, prefix /api): build `pnpm --filter @lms/api build` rồi
  `DATABASE_URL="postgresql://lms:lms_dev_password@localhost:5433/lms?schema=public" REDIS_URL="redis://localhost:6380"
   CODE_QUEUE_DRIVER=inline CODE_RUNNER_PROVIDER=stub JWT_ACCESS_SECRET=dev_access_secret
   JWT_REFRESH_SECRET=dev_refresh_secret API_PORT=3000 node apps/api/dist/main.js` (node FOREGROUND trong
  background-tool; ĐỪNG `&`).
- `prisma generate/migrate` EPERM nếu API dev đang chạy (khóa query_engine.dll) → TẮT API trước.
  Kill: `netstat -ano | grep :3000` → `taskkill //PID <pid> //F`.
- Web dev: `preview_start` name "web" (Vite 5173, proxy /api→3000). 5173 bận → `"autoPort": true` tạm trong
  `.claude/launch.json`; **Vite bind 5174+** → đọc `preview_logs` lấy port thật. Pane thường ẩn → dùng
  `get_page_text`/`read_page`/`javascript_tool`/computed CSS (screenshot timeout). Login qua fetch rồi
  `location.reload()`.
- Users dev: `admin@codespace.vn`/`Admin123!`, `teacher@codespace.vn`/`Password123!`,
  học viên demo `quizlearner+1786720247@codespace.vn`/`Learn123!` (member lớp có quiz + lesson gated).

### QUY TRÌNH
Đọc DESIGN §4.8/§5/§10 TRƯỚC. contracts→schema→backend→frontend, commit nhỏ có ý nghĩa. Mỗi bước:
`pnpm --filter @lms/api build && test` + `npx prisma format && npx prisma validate` + `pnpm validate` 16/16;
i18n vi/en parity; smoke live e2e. Cập nhật `CURRENT_STATE.md` + `ACTIVE_TASKS.md` (đánh dấu ✅ mục Nợ kỹ thuật
khi xử lý). Cuối cùng hỏi user merge main (FF-merge local, chưa push origin).

Bắt đầu: đọc DESIGN §4.8+§10, breakdown P6 vào `ACTIVE_TASKS.md`. Thứ tự đề xuất: **D1 → T6.0 Notification →
gamification (B) → T6.1 Audit UI → D2/D3 → T6.2 báo cáo → D4 PDF → D5/D6**. Làm theo lô, mỗi lô validate + commit.
````
