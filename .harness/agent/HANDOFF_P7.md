# HANDOFF — P7: Lesson Activities (bài học đa hoạt động)

> Prompt sẵn-để-dán cho session mới. Copy khối trong ``` vào session P7.
> Bối cảnh: user test thấy KHÔNG thêm được nội dung bài học. Nguyên nhân gốc: model + backend đã có
> `Lesson.contentMd/videoUrl/estimatedMinutes` và persist, NHƯNG (a) form FE tạo/sửa lesson chỉ gửi `title`;
> (b) DTO đọc về (author `LessonSummary`, student `MyLessonDto`) không trả nội dung. User quyết định nâng tầm:
> **1 bài học = nhiều activity** (markdown / pdf slide / video / quiz / coding / assignment).

## 🔒 Quyết định đã chốt (user duyệt — KHÔNG hỏi lại)
1. **Video = LINK nhúng** (YouTube/Vimeo/Google Drive) qua `<iframe>` sandboxed + allowlist domain. **KHÔNG upload video** (nặng, cần transcode/streaming — ngoài MVP). Upload video để dành nếu sau này thực sự cần.
2. **Markdown = react-markdown** (tắt raw HTML → chống XSS).
3. **PDF slide = upload** (multipart) → lưu qua `StorageAdapter` (`File` model đã có từ P6), HV xem nhúng.
4. Mô hình activity cho phép **nhiều PDF / nhiều video / nhiều loại** trong 1 lesson (danh sách có thứ tự).

---

```
Bạn tiếp nhận dự án CodeSpace LMS (monorepo pnpm: apps/api NestJS+Prisma, apps/web
React+Vite+Tailwind+TanStack Query+react-i18next). ĐỌC `AGENTS.md` ở root TRƯỚC (entry point mọi agent)
rồi chạy Default Startup Sequence: đọc `.harness/agent/CURRENT_STATE.md` + `.harness/agent/ACTIVE_TASKS.md`
+ MEMORY.md (đặc biệt memory `fe-nocturne-design` khi đụng FE apps/web — toàn app đã re-skin "Playful redesign"
trên nền Nocturne, PHẢI bám token/`cx-*`). Giao tiếp tiếng Việt; code/identifier/commit tiếng Anh.

## QUYẾT ĐỊNH ĐÃ CHỐT (user duyệt — KHÔNG hỏi lại)
- Video = **link nhúng** (YouTube/Vimeo/Drive) iframe sandbox + allowlist domain (KHÔNG upload video).
- Markdown = **react-markdown** (không raw HTML). PDF slide = **upload** qua StorageAdapter.
- 1 lesson chứa **nhiều activity có thứ tự** (nhiều pdf/video/loại tuỳ ý).

## VỊ TRÍ HIỆN TẠI
- **P0–P6 ✅ DONE** trên `main` local (commit mới nhất ~`8b886d6`, CHƯA push origin). `pnpm validate` 16/16
  (api 148 test). Docker Postgres :5433 / Redis :6380 (chạy `pnpm db:up` nếu tắt).
- **Đã có sẵn để tái dùng**: `File` model + `StorageAdapter`/`LocalStorageAdapter` (P6, path-traversal đã chặn);
  engine `quiz` (P4), `coding` (P3), `assignments` (P2) — đều đã link `lessonId`. Chuông notification (P6).
- **Gap (lý do bài học "không thêm được nội dung")**: `AddLessonForm` (`apps/web/src/pages/teach/TeachCourses.tsx`)
  chỉ gửi `{ title }`; author `LessonSummary` + student `MyLessonDto` KHÔNG trả `contentMd/videoUrl`.

## NHIỆM VỤ: P7 — Lesson Activities
Chuyển lesson từ "đơn nội dung" → **container activity có thứ tự**. Đi thứ tự `contracts → schema → backend →
frontend`. Bám pattern module có sẵn. GIỮ INVARIANT (không lộ đáp án quiz/hidden test/quiz draft; PBAC scope lớp;
file private + kiểm membership).

Các loại activity + nguồn dữ liệu:
- `markdown` → `contentMd` (render react-markdown)
- `pdf` → `fileId` → `File` (GV upload PDF)
- `video` → `videoUrl` (link nhúng iframe allowlist)
- `quiz` → `refId` → `Quiz` (engine P4)
- `coding` → `refId` → `CodingProblem` (engine P3)
- `assignment` → `refId` → `Assignment` (nộp link, P2)

### Task breakdown
- **T7.0 Contracts**: `LessonActivityDto` (author + student) + enum `LessonActivityType`; `Create/Update/
  ReorderLessonActivityRequest`; `FileUploadResponse`. Thêm `activities: LessonActivityDto[]` vào `MyLessonDto`
  và author lesson detail. (Giữ `contentMd/videoUrl` cũ làm legacy/fallback.)
- **T7.1 Schema + migration `p7_lesson_activities`**:
  `LessonActivity(id, lessonId, order, type, title?, contentMd?, fileId?, videoUrl?, refId?, createdAt, updatedAt)`
  `@@unique([lessonId, order])` + relation Lesson/File. **Data migration**: sinh activity markdown/video từ
  `Lesson.contentMd`/`videoUrl` đang có (tương thích ngược).
- **T7.2 Files module (MỚI)** `apps/api/src/files/`: `POST /files` (multipart `FileInterceptor` +
  `@UploadedFile`, **allowlist mime=application/pdf + giới hạn size** vd ≤20MB, `StorageAdapter.put`, tạo `File`
  ownerId=current) + `GET /files/:id` (guard: chủ sở hữu HOẶC thành viên active của lớp có activity dùng file —
  chống rò rỉ chéo lớp; trả stream private). Cài `@nestjs/platform-express` multer nếu cần.
- **T7.3 Backend activities** (trong `courses` module hoặc module `lesson-activities`): CRUD + **reorder** dưới 1
  lesson (author, quyền `course.update` + IDOR theo course→section→lesson). Student đọc qua `my-lessons`:
  resolve activity — quiz/coding/assignment → summary + kiểm LessonGate active; markdown/pdf/video → payload.
  **KHÔNG lộ**: đáp án quiz khi làm, quiz `published=false`, hidden test coding.
- **T7.4 FE Teach (activity builder)**: `TeachCourses` → editor bài học dạng **danh sách activity sắp xếp được**
  (thêm/xóa/đổi thứ tự). Mỗi loại 1 editor con: textarea markdown; upload PDF (gọi `POST /files`); ô URL video;
  chọn/tạo quiz·coding·assignment gắn vào lesson. Thay `AddLessonForm` "chỉ title".
- **T7.5 FE Learn (render)**: `LearnHome > LessonDetail` render activities theo `order` — markdown
  (react-markdown), PDF (`<iframe>`/pdf viewer qua `GET /files/:id`), video (iframe **allowlist** YouTube/Vimeo/
  Drive + `sandbox`), quiz/coding/assignment → mở workspace sẵn có (`LearnQuizWorkspace`/`LearnCodingWorkspace`/
  StudentAssignmentCard).
- **T7.6 Verify**: i18n vi/en parity; `pnpm validate` 16/16; `npx prisma format && validate`; smoke live e2e
  (GV soạn đủ 6 loại activity → HV xem markdown/pdf/video + làm quiz/coding/assignment, gate hoạt động,
  không lộ đáp án).

### RÀNG BUỘC BẤT BIẾN
- **Upload**: allowlist mime (PDF) + giới hạn size; `GET /files/:id` kiểm membership/gate (không rò rỉ file chéo
  lớp); private storage + auth. Path-traversal đã chặn ở `LocalStorageAdapter.resolveKey`.
- **Video**: chỉ nhúng domain trong allowlist, iframe `sandbox` — không nhúng URL tùy ý (chống clickjacking/inject).
- **Markdown**: react-markdown mặc định (no raw HTML) → chống XSS. Đừng bật `rehype-raw`.
- **Quiz/coding/assignment activity**: dùng lại endpoint cũ → tự giữ invariant không lộ đáp án/hidden/draft.
- PBAC scope theo lớp; route `:id` kiểm ownership/scope ở service. FE bám token Nocturne + `cx-*`.
- KHÔNG hard-delete dữ liệu quan trọng; ghi domain + audit/notification cùng transaction (pattern P5/P6).

### MÔI TRƯỜNG / GOTCHAS
- Docker Postgres :5433 / Redis :6380 (KHÔNG 5432/6379). `pnpm db:up` nếu tắt.
- Đụng contracts → `pnpm --filter @lms/contracts build` TRƯỚC `db:generate`/`migrate`/`seed`.
- `.env` permission-deny → truyền env INLINE. API dev (port 3000, prefix /api): build `pnpm --filter @lms/api build`
  rồi `DATABASE_URL="postgresql://lms:lms_dev_password@localhost:5433/lms?schema=public"
  REDIS_URL="redis://localhost:6380" CODE_QUEUE_DRIVER=inline CODE_RUNNER_PROVIDER=stub
  JWT_ACCESS_SECRET=dev_access_secret JWT_REFRESH_SECRET=dev_refresh_secret API_PORT=3000 node apps/api/dist/main.js`
  (FOREGROUND trong background-tool; ĐỪNG `&`).
- `prisma generate/migrate` EPERM khi API dev chạy → TẮT API trước (`netstat -ano | grep :3000` → `taskkill //PID <pid> //F`).
- Web dev: `preview_start` name "web" (Vite 5173, proxy /api→3000). 5173 bận → `"autoPort": true` tạm; Vite bind
  5174+ → đọc `preview_logs` lấy port thật. Pane thường ẩn → dùng `get_page_text`/`read_page`/`javascript_tool`
  (screenshot timeout). Login qua fetch rồi `location.reload()`.
- Users: `admin@codespace.vn`/`Admin123!`, `teacher@codespace.vn`/`Password123!`,
  học viên `quizlearner+1786720247@codespace.vn`/`Learn123!` (member lớp có quiz + lesson gated).

### QUY TRÌNH
Đọc `docs/DESIGN.md §4.2` (Lesson) + §4.8 (File) TRƯỚC. contracts→schema→backend→frontend, commit nhỏ có nghĩa
theo lô (T7.0-1 contracts+schema+migration → T7.2 files → T7.3 backend activities → T7.4 builder FE →
T7.5 render FE). Mỗi lô: `pnpm --filter @lms/api build && test` + `pnpm validate` 16/16 + i18n parity + smoke.
Cập nhật `CURRENT_STATE.md` + `ACTIVE_TASKS.md`. Cuối cùng hỏi user merge main (FF-merge local, chưa push origin).

Bắt đầu: xác nhận `File` model + `StorageAdapter` (đã có), rồi làm **T7.0 contracts + T7.1 schema/migration** trước.
```

---

## Ghi chú
- **Quy mô ~1 phase** (2–3 lô commit): có model + migration + module upload MỚI + builder FE.
- File `File` + `StorageAdapter` đã có (P6) → chỉ cần thêm **endpoint upload multipart** (`POST /files`) + serve có guard.
- Quiz/Coding/Assignment đã link `lessonId` → activity loại này chủ yếu là **gắn ref + sắp thứ tự**, không viết lại engine.
- Hoãn (ngoài MVP P7): chấm hoàn thành lesson theo tổng hợp activity (giữ complete thủ công như hiện tại); upload video.
