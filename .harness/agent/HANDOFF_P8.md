# HANDOFF — P8: Áp design mới cho khu vực Giảng dạy (Teach)

> Prompt sẵn-để-dán cho session mới. Copy khối trong ``` vào session P8.
> Bối cảnh: user vừa **viết lại §7 của design handoff** (`apps/web/design_handoff_lms_ui/README.md`) — trước đây
> §7 chỉ mô tả Teach dạng rút gọn 3 tab, nay mô tả **đầy đủ 6 tab thật + trình soạn hoạt động + sổ điểm**,
> bám đúng tên hook/biến trong code hiện tại (kể cả `useUserLookup`, `useAddActivity`, `activityMeta`,
> `LESSON_ACTIVITY_TYPES`, `MAX_UPLOAD_BYTES` mới thêm ở P7). Learn / Admin / Login **đã** playful từ trước —
> lần này CHỈ làm Teach.

## ⚠️ Đọc trước khi bắt đầu
- File design đang **CHƯA COMMIT** ở worktree chính (`git status` thấy `M` trên
  `apps/web/design_handoff_lms_ui/README.md` + `CodeSpace-LMS-design.html`). Session mới làm việc trên `main`
  ở worktree chính nên vẫn đọc được. **Nên commit chúng ở lô đầu tiên** để không mất.
- Đây là task **re-skin styling + layout**, KHÔNG đổi API/hook/routing/i18n key. Không có việc backend.

---

```
Bạn tiếp nhận dự án CodeSpace LMS (monorepo pnpm: apps/api NestJS+Prisma, apps/web
React+Vite+Tailwind+TanStack Query+react-i18next). ĐỌC `AGENTS.md` ở root TRƯỚC rồi chạy Default Startup
Sequence: đọc `.harness/agent/CURRENT_STATE.md` + `.harness/agent/ACTIVE_TASKS.md` + MEMORY.md (memory
`fe-nocturne-design`). Giao tiếp tiếng Việt; code/identifier/commit tiếng Anh.

## VỊ TRÍ HIỆN TẠI
- **P0–P7 ✅ DONE** trên `main` local (HEAD ~`3c0dbb2`, **ahead origin 6, CHƯA push**).
  `pnpm validate` 16/16 (api 183 test / 21 suite), i18n parity vi/en 354/354.
- Docker Postgres :5433 / Redis :6380. Container đã tồn tại → dùng `docker start lms-postgres lms-redis`
  (KHÔNG `pnpm db:up` nếu đang ở git worktree — trùng tên container).
- **Learn / Admin / Login đã áp playful redesign** từ trước. **Teach thì chưa** — vẫn là bản Nocturne phẳng
  đời đầu (card/seg/table cơ bản), riêng `TeachGradebook.tsx` còn **33 chỗ dùng class `slate-*`/`bg-white` thô**.

## NHIỆM VỤ: P8 — áp design mới cho toàn bộ khu vực Giảng dạy
Nguồn sự thật: **`apps/web/design_handoff_lms_ui/README.md` §7 (7a–7g)** — user vừa viết lại, mô tả rất chi tiết
từng tab. Đọc §7 TRƯỚC KHI CODE, và mở `CodeSpace-LMS-design.html` trong browser để xem look/flow thật.
KHÔNG copy markup/inline-style của prototype — tái tạo bằng React + Tailwind + token/`cx-*` sẵn có.

### Ngữ pháp layout dùng chung (README §7 nêu rõ — làm 1 lần rồi tái dùng cho mọi tab)
- **Sidebar 308px** (header có icon chip màu → danh sách card "sticker" → nút pill tạo mới ở đáy)
  + **cột detail** `minmax(0,1fr)` gap `--space-6`, mở đầu bằng header `.card` (tile icon 52px + tiêu đề +
  meta + actions), tiếp theo là các `<section>` có icon-chip đứng đầu.
- **Card đang chọn**: `color-mix(<màu category> 14%, surface)` + inset ring 1.5px cùng tông —
  **thay** cách cũ (`accent-900` + ring accent-700), để selection hiện theo màu riêng của item.
- Token/utility đã có sẵn trong `src/styles/nocturne.css`: `--cx-purple/amber/teal/coral/blue`,
  `--cx-radius`, `.cx-display` (Baloo 2), `.cx-tile/.cx-lift/.cx-press/.cx-float/.cx-bob/.cx-blob/.cx-dots`,
  `.cx-toggle`, `.cx-prose`. Icon: `<i className="ph|ph-fill ph-*">`. ĐỪNG tự chế token mới nếu đã có.

### Task breakdown (đi theo lô, mỗi lô 1 commit)
- **T8.0 Nền + shell**: commit file design đang dirty. `TeachHome.tsx` — thêm **teacher hero** (giống Learn hero:
  `.cx-dots` + gradient section + blob teal; eyebrow, h1 `.cx-display` 38px, dòng "còn N bài chờ chấm",
  3 stat chip; phải: ring conic tiến độ 132px + `mascot-laptop.png` 92px `.cx-bob`, nhớ chừa `margin-right`
  cho mascot khỏi bị cắt) + `.seg` 6 tab có icon (`ph-books` / `ph-users-three` / `ph-clipboard-text` /
  `ph-code` / `ph-check-square-offset` / `ph-trophy`). Key tab và `teach.tab_*` GIỮ NGUYÊN 1:1.
  Số liệu hero lấy từ hook thật nếu có sẵn; nếu chưa có endpoint thì tính từ dữ liệu đang fetch — **KHÔNG
  hardcode số giả** (bài học từ P6: gamification mock từng phải làm lại).
- **T8.1 Khóa học + trình soạn hoạt động**: `TeachCourses.tsx` (§7a) + `LessonActivityBuilder.tsx` (§7f —
  header band gradient tím, card activity **ray trái 3px theo `activityMeta(type).color`**, cụm nút ↑↓👁✏️🗑,
  panel "Xem trước như học viên thấy", 6 chip loại + trường theo loại, **drop zone PDF dạng dashed coral**).
- **T8.2 Lớp học**: `TeachClasses.tsx` (§7b) — card lớp có progress bar, sub-tab `.seg` Quản lý/Báo cáo,
  khu "Khóa học & thành viên" (form email + dòng xác nhận `useUserLookup` đã có ở P7), "Mở bài theo tiến độ"
  nhóm theo chương, và 4 KPI + phân phối điểm + tiến độ bài ở tab Báo cáo.
- **T8.3 Bài tập & Bài lập trình**: `TeachAssignments.tsx` (§7c — picker khóa/lớp, card đổi màu theo
  còn/hết bài chờ chấm, workspace chấm 2 cột) + `TeachCoding.tsx` (§7d — card theo độ khó, panel đề bài,
  test case có tag Ví dụ/Ẩn + 2 cột mono).
- **T8.4 Trắc nghiệm + Sổ điểm**: `TeachQuiz.tsx` (§7e — meta line đầy đủ, publish `.cx-toggle` trong khung pill,
  badge trộn câu/đáp án, tag loại câu hỏi) + `TeachGradebook.tsx` (§7g — **đây là màn DUY NHẤT còn viết bằng
  `slate-*` thô, phải port hẳn sang token Nocturne + `.card`/`.table`/`.tag`**).
- **T8.5 Verify**: `pnpm validate` 16/16 · i18n parity vi/en · smoke live MỌI tab Teach + builder hoạt động ·
  đối chiếu computed style với token (đừng chỉ nhìn ảnh) · cập nhật `CURRENT_STATE.md` + `ACTIVE_TASKS.md`.

### RÀNG BUỘC BẤT BIẾN
- **Chỉ đổi lớp visual/layout.** GIỮ NGUYÊN: hook `src/features/*/hooks.ts`, routing, **key i18n** (thêm key mới
  thì phải thêm CẢ vi lẫn en — parity phải sạch). KHÔNG sửa `apps/api`, KHÔNG sửa schema.
- Mọi chuỗi hiển thị đi qua `t()`. Trong `TeachClasses.tsx` hiện còn vài chuỗi hardcode tiếng Việt
  ("Quản lý lớp", "Báo cáo & Thống kê", các nhãn trong `ClassReportPanel`) — nhân tiện đưa vào i18n.
- **Không phá invariant bảo mật**: surface author (TeachQuiz/TeachCoding) ĐƯỢC xem đáp án/hidden test — đó là
  đúng; nhưng đừng tái dùng component author cho màn học viên. Preview trong builder phải dùng lại
  `MarkdownBlock`/`PdfBlock`/`VideoBlock` thật (react-markdown KHÔNG bật `rehype-raw` — chống XSS).
- Motion gate sau `prefers-reduced-motion: reduce` (`.cx-float/.cx-bob/.cx-shooting-star`/blob).
- Không thêm CSS ad-hoc cho hover/press/focus — Nocturne đã có.

### MÔI TRƯỜNG / GOTCHAS
- Web dev: `preview_start` name "web" (Vite 5173, proxy /api→3000). **Pane thường ẩn → screenshot timeout**;
  dùng `get_page_text` / `read_page` / `javascript_tool` (đọc `getComputedStyle` để verify token).
- API dev (cần cho smoke): build `pnpm --filter @lms/api build` rồi
  `DATABASE_URL="postgresql://lms:lms_dev_password@localhost:5433/lms?schema=public"
  REDIS_URL="redis://localhost:6380" CODE_QUEUE_DRIVER=inline CODE_RUNNER_PROVIDER=stub
  JWT_ACCESS_SECRET=dev_access_secret JWT_REFRESH_SECRET=dev_refresh_secret API_PORT=3000
  node apps/api/dist/main.js` (FOREGROUND trong background-tool; ĐỪNG `&`).
- `prisma generate` (trong `pnpm validate`) **EPERM khi API dev đang chạy** → TẮT API trước khi validate:
  `netstat -ano | grep :3000` → `taskkill //PID <pid> //F`.
- Users: `teacher@codespace.vn`/`Password123!` (instructor — dùng cho MỌI màn Teach),
  học viên `p7member@codespace.vn`/`Learn123!` (member lớp "Lop P7" có đủ 6 loại activity + gate mở),
  `p7outsider@codespace.vn`/`Learn123!` (ngoài lớp). **`admin@codespace.vn` KHÔNG dùng được `Admin123!`**.
- Dữ liệu sẵn để soi UI: khóa **"P7 Smoke"** (`p7-smoke-1787077266`) → chương "Chuong 1" → bài "Bai 1" có
  6 activity đủ loại; lớp **"Lop P7"**.

### QUY TRÌNH
Đọc `apps/web/design_handoff_lms_ui/README.md` **§7 + phần Design Tokens + "The playful layer"** TRƯỚC.
Mỗi lô: web typecheck + lint (baseline: 0 error, 1 warning cũ ở `useSampleRunner.ts`) + build + smoke live màn
vừa đổi, rồi commit. Cuối cùng `pnpm validate` 16/16 + cập nhật state/tasks + hỏi user merge main
(FF-merge local, chưa push origin).

Bắt đầu: commit 2 file design đang dirty, rồi làm **T8.0 (hero + 6 tab)** để chốt ngữ pháp layout trước.
```

---

## Ghi chú

- **Quy mô ~1 phase FE thuần**, 8 file / ~3.300 dòng TSX:
  `TeachHome.tsx` (61) · `TeachCourses.tsx` (390) · `TeachClasses.tsx` (453) · `TeachAssignments.tsx` (348) ·
  `TeachCoding.tsx` (404) · `TeachQuiz.tsx` (780) · `TeachGradebook.tsx` (364) · `LessonActivityBuilder.tsx` (481).
  Chia 5 lô như trên để mỗi session giữ context ≤ 40%.
- **Không có việc backend.** Mọi hook README §7 nhắc tới đều đã tồn tại (kể cả `useUserLookup`,
  `useAddActivity`/`useReorderActivities`/`useUploadFile`, `useClassReport`, `useClassGradebook`).
  Nếu phát hiện hook còn thiếu → dừng, ghi vào ACTIVE_TASKS, hỏi user; đừng tự mở rộng API trong task styling.
- **Nợ song song (không chặn P8, đã ghi ở `ACTIVE_TASKS.md`)**: không còn nợ CHẶN — lỗi bảo mật P5
  (`currentUser.id` undefined) và lỗi PDF chứng chỉ tiếng Việt đều đã vá ở phiên P7.
