# Current State

<!-- SIZE LIMIT: 500 lines. Do not exceed. Refactor into specialized docs if approaching limit. -->

Updated: 2026-11-07

## Project Stage

**P0–P9 ✅ ALL PHASES DONE.** Hệ thống đã đóng gói được để chạy thật trên 1 VPS;
chưa deploy lên máy thật (chưa mua VPS, chưa có tài khoản Cloudinary).
### Ba lô BlockSpace (2026-11-07) — nhánh `claude/gallant-shannon-ea4da2`, chưa push/PR/deploy

Ba lô trong trình soạn hiện và dùng được: cất nhân vật / trang phục / âm thanh / khối lệnh, kéo ra ở dự án khác. Chỉ đổi
`bridge.js` (không cần release editor mới); API `/scratch/backpack` chỉ của chính mình, 100 mục · 10 MB/mục · 50 MB/người.
**Migration mới `20261107090000_p11_scratch_backpack`** (bảng `scratch_backpack_items`) — chưa áp lên DB dev `lms` và production.
`pnpm validate` đạt 18/18 task (api 612 test / 40 suite, web 48). Không gọi `scratch.mit.edu`. Chi tiết + bẫy: `HANDOFF_P11.md §Ba lô`.

### Bản ghép chờ PR (2026-11-04) — nhánh `claude/focused-kapitsa-de036f`, chưa push/PR/deploy

Đã ghép việc bài lập trình + C1 + vá IDOR + C3 + C4. `pnpm validate` đạt 18/18 task (api 596 test / 39 suite), i18n 832/832; 41 ca đầu cuối
trên API thật (DB tạm, đã xóa) đều đạt, với runner stub. Xem bằng mắt GV phụ trách + GV lớp khác trên bản đủ C4; HV xem trên bản trước C4. Migration `backfill_lesson_complete_xp` đã thử trên một ca
tự tạo: cộng 50 XP theo ngày cũ, chạy lại không cộng thêm. DB dev `lms` chưa áp 2 migration mới nhất (`close_orphan_lesson_gates`, backfill).

### Phạm vi GV theo lớp (C4, 2026-11-04) — nhánh `claude/hungry-mendel-e230df`, xếp chồng lên nhánh vá IDOR bên dưới, chưa PR
Không đổi schema. **Người dùng chốt: GV được xem mọi lớp, chỉ ghi ở lớp mình phụ trách.**

- **`rbac/guards/class-staff.guard.ts`** đặt sau PermissionsGuard, dùng lại quyền của `@RequirePermission`: `PATCH classes/:id`, gán/gỡ khóa,
  thêm/gỡ thành viên, `PUT gates`, `POST gradebook/recompute`. GV lớp khác 403; lớp không tồn tại GV 403, admin 404.
- **Đọc vẫn mở cho mọi GV:** `GET /classes`, `teach/overview`, chi tiết lớp, báo cáo, gate, sổ điểm, danh sách chứng chỉ, leaderboard.
  Bài làm từng em (quiz, bài nộp, code, PDF chứng chỉ) vẫn chỉ người phụ trách, theo bản vá bên dưới.
- **Bẫy:** tab Sổ điểm mở sổ bằng `POST recompute`. `GET /classes/:id/my-access` (mới) cho FE biết để dùng GET và ẩn nút ghi; GV lớp khác thấy
  điểm tới lần tổng hợp gần nhất.
- **Vá `files/:id`:** `course.update` global không còn đọc được PDF chứng chỉ, file đó theo luật của `certificates/:id/pdf`.
- **Đã kiểm:** `pnpm validate` 18/18 task (api 588 test / 39 suite). API thật trên DB bản sao `lms_c4` (đã xóa, DB dev không đổi), 6 vai, 16 route đều
  đúng. Xem bằng mắt: GV lớp khác chỉ đọc, không 403 trên console; GV tạo lớp đủ nút ghi.

### C3: pass bài không còn tự hoàn thành bài học (2026-11-04) — nhánh `claude/elastic-dijkstra-28d486`, chưa mở PR

- **Người dùng chọn hướng (a):** nộp bài lập trình/trắc nghiệm, đạt hay không, chỉ đặt `in_progress` và không đụng bài đã
  `completed`. Học viên tự bấm Hoàn thành mới có `completed` + 50 XP `lesson_complete`. Quiz cùng lỗi nên sửa cùng hướng.
- **Đánh đổi đã biết:** ai pass mà quên bấm thì bài không tính vào mốc 80% của chứng chỉ và báo cáo lớp.
- **Dữ liệu đổi:** migration `backfill_lesson_complete_xp` (không đổi schema) bù 50 XP cho bài đã `completed` mà thiếu
  `lesson_complete`; giữ nguyên trạng thái, `createdAt` = lúc hoàn thành nên không lật bảng xếp hạng tuần này, chạy lại
  không cộng thêm. Không đụng streak/huy hiệu/thông báo: `first_lesson` sẽ trao ở lần hoàn thành bài kế tiếp.
- **Hai lỗi FE lộ ra khi thử:** nộp xong không làm mới danh sách bài/XP/bảng xếp hạng (nay `invalidateLearningProgress`);
  lời chúc mừng ghi cứng +40 XP trong khi cộng 50 (nay lấy từ `XP_REWARDS`).
- **Đã thử** bằng `p7member` qua API và giao diện, trên DB `lms_c3` tách riêng (bản sao DB dev, đã xóa sau khi thử) với
  runner stub. **Chưa áp** migration lên DB dev `lms` và production.

### Vá IDOR bài làm theo lớp (2026-11-04) — nhánh `claude/affectionate-archimedes-33c346`, xếp chồng lên `claude/magical-bouman-307820`, chưa PR
Không đổi schema.

- **Luật chung nằm ở `RbacService.isClassStaff(userId, classId, permissions, mode)`**, thay cho `assertCanReviewSubmissions`.
  Có permission trong phạm vi lớp chưa đủ, vì `instructor` gán global và `student` cũng có `*.result.read`. Phải thêm một trong:
  role gán riêng cho lớp, người tạo lớp, instructor/TA active của lớp, admin (`class.delete` global). Role gán theo lớp phải tự đủ
  quyền: GV lớp khác mang thêm role `student` ở lớp này vẫn 403 (bản coding cũ để lọt ca này).
- **Đã đi qua luật này:** đọc `quiz-attempts/:id`, `submissions/:id`, danh sách bài nộp của bài tập, `scratch/submissions/:id/*`,
  `certificates/:id/pdf`; ghi `submissions/:id/grade`, `certificates/issue`, `certificates/:id/revoke`.
- **Đổi hành vi:** GV không phụ trách lớp nay 403 ở các route trên, muốn dạy thay thì thêm vào lớp. Chứng chỉ của lớp đã xóa chỉ admin
  đọc/thu hồi được. `revoke` kiểm quyền trước trạng thái thu hồi.
- **Test phạm vi lớp dùng `rbac/testing/real-rbac.ts`** (RbacService thật trên DB giả), vì mock `hasPermission` che mất loại lỗi này.
- **Đã kiểm:** `pnpm validate` 18/18 task (api 557 test / 38 suite). API thật trên DB bản sao `lms_idor` (đã xóa, DB dev không đổi), 10 vai:
  trước khi vá, HV ngoài lớp, bạn cùng lớp và GV lớp khác đều đọc được quiz (200); sau khi vá đều 403, chủ bài/GV tạo lớp/TA/admin 200,
  id không tồn tại 404. Riêng `scratch/.../assets` chỉ kiểm bằng unit test: DB dev không có asset nên API thật chỉ thử `project.json`.
- Phần cấp lớp còn lại: xem mục C4 ở trên.

### GV xem bài nộp (C1, 2026-11-04) — nhánh `claude/magical-bouman-307820`, xếp chồng lên `claude/focused-kapitsa-de036f`, chưa PR

- **API:** `GET /classes/:classId/coding-submissions` (bài của lớp + số em đã nộp/đạt), `.../:problemId` (từng học viên, không
  kèm code), `GET /coding-submissions/:id/review` (code + đầu vào/mong đợi/output từng test, cả test ẩn). Không đổi schema.
- **Quyền nằm ở `assertCanReviewSubmissions` (nay gọi `RbacService.isClassStaff`):** `coding.result.read` + `coding.read` (học viên không có), và là một trong: quyền
  gán riêng cho lớp đó, người tạo lớp, instructor/TA active của lớp, admin (`class.delete` global). GV role global lớp khác
  bị 403: muốn dạy thay thì thêm vào lớp. Bài của lớp đã xóa (`classId` null) chỉ admin đọc được.
- **Vá IDOR có sẵn:** `GET /coding-submissions/:id` chỉ kiểm `coding.result.read`, mà role `student` global cũng có, nên học viên
  đọc được bài của bạn kèm output test ẩn (`p7member` có role này trên DB dev). Nay dùng chung cổng trên.
- **`GET /coding-submissions/:id` vẫn trả output test ẩn cho GV** còn chủ bài thì không; review không dành cho chủ bài là học viên.
- **FE:** `pages/teach/TeachCodingSubmissions.tsx`; `codingUi.tsx` chứa mảnh dùng chung với phần biên soạn.
- **Đã kiểm:** `pnpm validate` 18/18 task (api 504 test / 38 suite); API thật: GV lớp 200, học viên cùng lớp/ngoài lớp/GV lớp khác
  403, id không tồn tại 404; xem bằng mắt tài khoản `p11teacher`. Runner là stub nên chưa thử với Piston. Dữ liệu thử đã dọn khỏi DB dev.

### Bài lập trình: vào lại + danh sách GV (2026-11-03) — nhánh `claude/focused-kapitsa-de036f`, chưa PR/deploy

- **Vào lại bài đã nộp.** Bài nộp, điểm, XP vốn được lưu đúng; thiếu đường đọc lại. Nay `GET attempt` trả `myProgress`
  (số lần nộp, đã từng đạt, điểm cao nhất, lần nộp gần nhất kèm code), `GET for-class` trả `myStatus`. Không đổi schema.
- **Vá lộ test ẩn:** `results[].actualStdout` của test ẩn không còn trả cho học viên (`print(input())` in được input ẩn);
  GV có `coding.result.read` vẫn thấy. Chỉ đổi DTO, UI không dùng trường này.
- **Danh sách GV** (`pages/teach/codingGroups.ts`): nhóm chương → bài học, tìm không dấu, lọc độ khó, cuộn riêng. Lọc ở client
  nên `listCodingProblems` nạp đủ mọi trang (trước đây dừng ở 100 bài).
- **Sổ điểm của học viên** (`my-gradebook`) tính trực tiếp từ bài nộp của chính em, vẫn chỉ đọc; không còn chờ staff mở sổ
  (áp dụng cả bài tập + quiz). `GradeEntry` vẫn chỉ cập nhật ở `recompute`, nên `GET /gradebook` và báo cáo lớp (`getClassReport`)
  chỉ mới sau khi staff mở sổ. Cột chưa có `GradeItem` trả id tạm `<sourceType>:<sourceId>`, chỉ là khóa trong DTO.
- **Hành vi đã đo trên API thật (runner stub):** XP `coding_pass` 100 chỉ cộng một lần; sổ điểm lấy điểm cao nhất. Việc còn hở:
  `ACTIVE_TASKS.md §Bài lập trình`.
- **Bẫy worktree:** thiếu `apps/studio/dist` thì `vite-plugin-static-copy` bỏ cả Monaco (`/monaco/vs/loader.js` 404, trình soạn
  kẹt "Loading…") → chạy `pnpm --filter @lms/studio build` trước khi `dev`. Muốn thử bài pass với runner stub: để
  `expectedStdout` trùng `stdin`, vì stub chỉ echo stdin.

### Bug gỡ khóa khỏi lớp (2026-11-02) — nhánh `claude/lms-deleted-course-display-cbcfb2`

- `ClassesService.removeCourse` chỉ xóa `class_courses`, gate vẫn mở nên học viên còn thấy và làm được bài của khóa
  đã gỡ. Nay đóng gate trong cùng transaction. Gán lại khóa: bài ở trạng thái khóa, GV mở lại; tiến độ/bài nộp giữ nguyên.
- **Dữ liệu đổi:** migration `close_orphan_lesson_gates` đóng gate mồ côi có sẵn (không đổi schema).

### P11 · BlockSpace đang làm (2026-10-07) — nhánh `claude/blockspace-scratch-studio-p11-d86c69`

- `main` = `e203005` (PR #5: ConfirmDialog thay `window.confirm`) — **CHƯA phát hành lên production**
  (người dùng xác nhận 07/10). Production vẫn ở bản trước đó.
- Nhánh P11 = `main` + 5 commit kế hoạch/spike T11.1 (đặt lại lên `e203005`, nội dung trùng `9365d0e`)
  + T11.0. Chi tiết, số đo, việc còn lại: `HANDOFF_P11.md`.
- **Schema đổi (T11.2):** migration `p11_scratch_projects` — 6 bảng `scratch_*` mới, không đụng bảng cũ.
- **Schema đổi (T11.5b):** migration `p11_public_sharing` — 3 bảng (`scratch_publications`, `scratch_nicknames`,
  `scratch_reports`) + quyền `scratch.moderate` cho admin/super_admin (cấp trong migration, không chỉ seed).
- **DB dev đã bị xóa sạch 07/10** (lỗi `migrate diff` dùng DB dev làm shadow) rồi dựng lại qua API:
  `p11teacher@codespace.vn` (instructor, tạo khóa + lớp), `p7member@codespace.vn` (HV trong lớp),
  `p7outsider@codespace.vn` (HV ngoài lớp) — mật khẩu `Learn123!`; admin seed `p9-admin@codespace.local`.
  Khóa "Lập trình Scratch cơ bản" (published, 3 bài, mỗi bài 1 activity markdown), lớp `SCR-DEV-01`
  (bài 1–2 mở gate, bài 3 khóa). Dữ liệu P7–P10 cũ (bài nộp, XP, huy hiệu trao tay…) KHÔNG còn.
- Trình soạn build sẵn ở GitHub Releases `blockspace-editor-15.2.0-bs1`, sha512 đã ghim (`HANDOFF_P11.md §T11.0`).
  `apps/studio/src/bridge.js` (T11.6b) không nằm trong tarball — đổi bridge KHÔNG cần release editor mới.
- **Làm chung (T11.6b) cần WebSocket `/api/scratch/ws`** qua Caddy (reverse_proxy tự chuyển Upgrade) — kiểm khi
  deploy. Không đổi schema (bảng `scratch_collaborators` có từ T11.2). DB dev có dự án mẫu "Mê cung làm chung"
  của `p7member` với đồng tác giả `p7outsider`.
- **Schema đổi (T11.7):** migration `p11_lms_integration` — thêm giá trị enum `scratch` (LessonActivityType,
  SubmissionType), 2 cột NULL được (`assignments.scratchChecks`, `submissions.scratchVersionId`), bảng
  `scratch_activity_copies`. Đã áp lên DB dev (backup trước: `scratchpad/db-before-t117.sql`), không lệch schema.
- **Schema đổi (T11.8):** migration `p11_scratch_comments` — cột `scratch_projects.commentsEnabled` (mặc định true),
  3 bảng (`scratch_comments`, `scratch_comment_reports`, `scratch_banned_words` + 24 từ mặc định). Đã áp lên DB dev
  (backup trước: `scratchpad/db-before-t118.sql`), không lệch schema.
- **Code P11 xong T11.0–T11.8.** Trước khi phát hành: H6 pháp lý AGPL, mở PR nhánh P11 vào `main` (PR #5 vẫn chưa
  phát hành — sẽ lên cùng), deploy kiểm Caddy WebSocket `/api/scratch/ws` + 4 migration P11.

### P10 · ĐÃ PHÁT HÀNH LÊN PRODUCTION (2026-08-26, ~16:27 giờ VN)

`main` = `a10b41f` (PR #3). Ảnh `latest` trên GHCR khớp đúng digest của commit merge (đã đối chiếu
trước khi phát hành — nếu chỉ web build xong mà api chưa, `release.sh` sẽ dựng frontend MỚI trên
backend CŨ và mọi trang P10 hỏng, vì migration chạy từ trong ảnh api chứ không từ git checkout).

**Đo trước khi phát hành thay vì đoán:** 0 hoạt động trong 60 phút (bài nộp / chấm code / quiz /
tiến độ đều 0), đăng nhập gần nhất 2 ngày trước, DB có **0 `xp_events`, 2 user, 0 lớp** — chưa
khai giảng. Nên backfill quét bảng rỗng và không có học viên nào bị ảnh hưởng.

**Vấp một lần ở bước 1:** `ops/release.sh` chết vì `mkdir: cannot create directory
'/var/backups/lms'` — `/var/backups` thuộc root 755, user `deploy` không tạo được thư mục con, và
`bootstrap-vps.sh` chưa bao giờ tạo nó (hệ quả của O4 bỏ dở). Script `set -e` nên dừng **trước**
khi kéo ảnh và trước migration → production không bị đụng gì. Đã tạo
`/var/backups/lms` (chủ `deploy`, chmod 700) và **vá `ops/bootstrap-vps.sh`** để máy dựng mới
không vấp lại.

**Kết quả đã kiểm chứng trên máy thật (không tin lời script):**
- `https://lms.codespace.edu.vn/` HTTP 200, `/api/health` ok.
- Ba endpoint mới trả **401** (có route, đòi đăng nhập) chứ không phải 404.
- DB: 9 huy hiệu, **3 cái `isManual`** — migration seed huy hiệu chạy đúng, đây chính là lỗi
  suýt làm ô chọn huy hiệu rỗng trên production.
- Cột mới của `xp_events` (2) và `user_badges` (3) có đủ, index `xp_events_classId_createdAt_idx` có.
- **`users` vẫn đúng 2 dòng** — không migration nào đụng tới tài khoản.
- Sao lưu tự động của `release.sh` chạy được: `lms-20260826T092713Z.sql.gz`, gzip hợp lệ,
  3194 dòng, 39 `CREATE TABLE`.
- RAM sau phát hành: **555 MB / 1967**, swap chưa chạm — thấp hơn cả mốc nền 579 MB của P9.

**O4 vẫn CHƯA xong:** đã có thư mục sao lưu cục bộ, nhưng **chưa có bản sao ngoài máy** và
**`ops/restore.sh` vẫn chưa được thử lần nào**. Bản sao lưu duy nhất nằm trên chính con VPS đó.

### P10 · Verify trên DB thật + 3 bản vá (2026-08-26)

Chạy migration thật trên DB dev, dựng lớp/học viên/bài nộp qua API thật, xem cả 3 màn hình.
Kết quả: **backfill đúng** (7/8 dòng gắn đúng lớp, 4/4 `lesson_complete` khớp `lesson_progress`,
dòng suy-không-ra để NULL), 4 ca chặn của T10.3 đúng trên API thật (kể cả **super_admin có
`grade.write` global vẫn 403**), audit `metaJson` KHÔNG lọt tên người lẫn lời nhắn, đồng điểm
đồng hạng (#1, #1, #3) đúng trên dữ liệu thật, tiếng Việt lưu UTF-8 chuẩn khi gõ từ giao diện.

**Ba lỗi chỉ lộ ra khi gặp dữ liệu thật — đã vá:**

1. **T10.3 chết ngay với dữ liệu thật.** DB có 20 `class_members`, **TẤT CẢ đều `student`, không
   một `instructor`/`ta` nào** — giáo viên tạo lớp rồi thêm học viên, không tự thêm mình. Cổng
   quyền cũ (bắt buộc là thành viên instructor/ta) sẽ 403 với mọi GV trên mọi lớp.
   → `assertCanAwardInClass` chấp nhận thêm **`Class.createdById`**. Vẫn là tín hiệu theo TỪNG LỚP
   nên không mở đường trao xuyên lớp; có test cho cả "người tạo lớp khác vẫn bị chặn".
2. **Bảng xếp hạng hiện "0 bài học · 0 trắc nghiệm · 0 lập trình" cạnh "50 XP"** — trông như hỏng,
   vì XP thưởng tay không thuộc ba ô đếm nỗ lực. → thêm `LeaderboardEntryDto.bonusXp` + chip
   "50 XP cô/thầy thưởng".
3. **`/admin/overview` báo "2 Học viên" trong khi có 12 em đang học.** Đếm theo `role = student`
   là sai: **16/24 tài khoản không mang role nào**, các em được tạo rồi thêm thẳng vào lớp.
   → đếm hợp **role LẪN ghi danh lớp**; ai vừa dạy vừa học chỉ tính vào cột giáo viên.

**Dữ liệu test đã DỌN SẠCH** (2026-08-26, một transaction): tài khoản `t105-*`, lớp `T10-VERIFY`,
bài tập + 2 bài nộp, 8 dòng `xp_events` fixture, và mọi huy hiệu / XP thưởng / thông báo / audit
sinh ra từ các lượt trao thử — kể cả những thứ bám vào `p7member`/`p7outsider`. Đã kiểm: không sót,
không bản ghi mồ côi, DB về đúng trạng thái trước phiên (22 user, 10 lớp, 20 ghi danh, 0 `xp_events`).
**3 huy hiệu trao tay (`helping_hand`/`good_question`/`big_progress`) GIỮ LẠI** — đó là dữ liệu của
tính năng do seed tạo, không phải dữ liệu test.

**Tài khoản dev đăng nhập được** (đã kiểm): `p7member@codespace.vn` và `p7outsider@codespace.vn`,
mật khẩu `Learn123!`. `admin@codespace.vn`, `teacher@codespace.vn`, `student1@codespace.vn`
KHÔNG đăng nhập được bằng mật khẩu nào đã ghi trong tài liệu — cần đặt lại nếu muốn dùng.
Muốn dựng lại môi trường thử T10.3: phải có một GV **tạo lớp** (hoặc là thành viên instructor/ta),
vì đó là điều kiện của `assertCanAwardInClass`.

`pnpm validate` 16/16 (api **320 test / 28 suite**), i18n parity **563/563**.

### P10 · T10.1, T10.3, T10.5 — đã tách ra

Quyết định và số đo: [p10-t10-1-3-5-notes.md](../../docs/archive/completed_tasks/p10-t10-1-3-5-notes.md).

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
### Lịch sử trước P7 — đã tách ra

Vá lỗi bảo mật P5, vá PDF chứng chỉ tiếng Việt, tóm tắt P0–P6, hai vòng review P5/P6, playful
redesign, Nocturne re-skin, P3+P4: xem
[docs/archive/completed_tasks/pre-p7-history.md](../../docs/archive/completed_tasks/pre-p7-history.md).
Tách ra 2026-08-26 vì file này chạm trần 500 dòng.

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
**P10 đã lên production 2026-08-26** (`main` = `a10b41f`) — chi tiết ở mục "P10 · ĐÃ PHÁT HÀNH".
Trạng thái production, việc còn lại trước khi mở lớp, và bẫy đã gặp: **`.harness/agent/HANDOFF_P10.md`**.

**P10 đang chạy.** T10.1 ✅, T10.3 ✅, T10.5 ✅. Còn **T10.2** (mục tiêu chung của lớp) và
**T10.4** (streak nhân văn — cần chốt trước: `Class` chưa có lịch học hằng tuần).

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
