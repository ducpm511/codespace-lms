# HANDOFF — P10: Gamification giai đoạn 2 + Admin redesign

> Cập nhật 2026-08-26. **T10.1 · T10.3 · T10.5 ✅ XONG và ĐÃ CHẠY TRÊN PRODUCTION.**
> Còn lại: **T10.2** và **T10.4**.

---

## PHẦN A — Trạng thái production

- URL: **https://lms.codespace.edu.vn** (TLS Let's Encrypt hạn 22/11/2026, Caddy tự gia hạn)
- VPS: TINO, `103.142.27.54`, Ubuntu 24.04, 2 vCPU / 1.9 GB / 29 GB
- Vào máy: `ssh deploy@103.142.27.54` (chỉ key; `sudo` không cần mật khẩu; root SSH đã tắt).
  Mất key → **Console/VNC của TINO**.
- Repo trên máy: `/srv/lms`. Secret ở `/srv/lms/.env.production` (chmod 600).
- Admin: `ducpm@codespace.edu.vn` (Phạm Minh Đức) và `huyenhn@codespace.edu.vn` (Hoàng Ngọc Huyền).
- 4 container: caddy / api / postgres / piston. `STORAGE_DRIVER=local`, `CODE_QUEUE_DRIVER=inline`.
- **`main` = `a10b41f`** (PR #3). Ảnh `latest` trên GHCR khớp đúng digest commit đó.
- RAM sau phát hành P10: **555 MB / 1967**, swap chưa chạm. Còn trống ~1.4 GB.
- **DB gần như rỗng: 2 user, 0 lớp, 0 `xp_events`, 0 bài nộp.** Chưa khai giảng.

### CI/CD

| Khi nào | Chạy gì | Ai quyết |
|---|---|---|
| Mở PR | `pnpm validate` + i18n parity | tự động |
| Merge `main` | Build 2 ảnh → GHCR (public) | tự động |
| Phát hành | `cd /srv/lms && git pull && ops/release.sh` (~1 phút) | **người** |

**TRƯỚC KHI CHẠY `release.sh`, PHẢI kiểm ảnh đã build xong CẢ HAI chưa:**

```bash
SHA=$(git rev-parse origin/main)
for i in api web; do docker manifest inspect ghcr.io/ducpm511/codespace-lms-$i:$SHA >/dev/null 2>&1 \
  && echo "$i OK" || echo "$i CHƯA CÓ"; done
```

Hai ảnh build **song song, `fail-fast: false`**. Nếu chỉ `web` xong mà `api` chưa, `release.sh`
kéo `latest` của cả hai → **frontend mới chạy trên backend cũ**, mọi trang mới hỏng. Migration
cũng không chạy, vì nó chạy từ **trong ảnh api**, không phải từ git checkout. Đã suýt vấp lần này.

### ⚠️ Việc vận hành CÒN LẠI

| # | Việc | Trạng thái |
|---|---|---|
| O2 | Smoke đầy đủ RUNBOOK §4 **qua giao diện thật** | ❌ chưa — mới kiểm ở mức HTTP |
| O4a | Thử `ops/restore.sh` | ✅ **XONG 2026-08-26** |
| O4b | **Sao lưu ngoài máy** | ❌ chưa — chặn bởi H3 |
| O4c | **Lịch sao lưu tự động** | ❌ chưa — máy KHÔNG có cron, dùng systemd timer (mẫu ở RUNBOOK §5) |
| O5 | Đổi mật khẩu admin, xoá `SEED_ADMIN_*` khỏi `.env.production` | ❌ chưa |

**O4b là rủi ro cao nhất hiện nay.** Cả hai file sao lưu nằm trên chính con VPS đó. Máy chết là
mất cả hai. `rclone` đã cài sẵn (v1.60.1) nhưng chưa có remote nào.

### Việc cần người quyết

| # | Việc | Chặn cái gì |
|---|---|---|
| H1 | Tài khoản Cloudinary → `STORAGE_DRIVER=cloudinary` | Xác minh T9.3 thật |
| H2 | Chốt email provider (gợi ý Resend) | Quên-mật-khẩu |
| H3 | **Chốt đích sao lưu ngoài máy (R2/B2)** | **O4b — rủi ro cao nhất** |
| H5 | `Class` chưa có lịch học hằng tuần | **T10.4** — xem §T10.4 |

---

## PHẦN B — P10 đã làm được gì (ĐỪNG bàn lại)

### T10.1 — Bảng xếp hạng theo lớp, theo tuần ✅

`GET /classes/:classId/leaderboard?week=current|previous`

- `XpEvent.classId` nullable + FK SetNull + index `(classId, createdAt)`. Migration có backfill suy
  lớp từ chính sự kiện domain; suy không ra thì để NULL và bảng bỏ qua — **không đoán bừa**.
- **KHÔNG gắn `@RequirePermission`**: `class.read` là quyền GV/admin, gắn vào thì chính học viên
  không xem được lớp mình. Quyền kiểm ở service: thành viên `active` HOẶC `class.read` đúng lớp đó.
- Mốc tuần = **thứ Hai 00:00 giờ VN** (`weekWindowVn`, dùng chung `APP_TZ_OFFSET_MS` với streak).
- Chỉ xếp hạng `roleInClass = student` đang active. Đồng điểm → đồng hạng (1, 1, 3).
- `LeaderboardEntryDto.bonusXp` tách riêng XP thưởng tay: gộp chung thì dòng
  "0 bài học · 0 trắc nghiệm · 0 lập trình" đứng cạnh "50 XP" và trông như lỗi.

### T10.3 — Giáo viên trao thưởng thủ công ✅

`POST /gamification/students/:studentId/awards` (không phải `/users/:id/badges` như bản nháp —
một lượt trao lo cả huy hiệu lẫn XP nên tên theo việc nó làm).

- **Chỗ chặn thật là PHẠM VI LỚP, không phải permission.** Role `instructor` gán ở phạm vi GLOBAL
  nên chỉ kiểm `grade.write` là trao được xuyên lớp. `assertCanAwardInClass` đòi: có `grade.write`
  **VÀ** (là `Class.createdById` **HOẶC** instructor/ta active của chính lớp đó).
- ⚠️ **Nhánh `createdById` là bắt buộc, đừng gỡ.** Dữ liệu thật: 20 `class_members`, **TẤT CẢ đều
  `student`, không một instructor/ta nào** — GV tạo lớp rồi thêm học viên chứ không tự thêm mình.
  Bỏ nhánh này là tính năng 403 với mọi GV trên mọi lớp.
- XP thưởng tay có trần **5–200** (`MANUAL_XP_MIN/MAX` ở contracts). XP này tính vào bảng xếp hạng
  tuần; không có trần thì một lượt thưởng lật ngược cả bảng.
- `sourceId` = `randomUUID()` từng lượt. Dùng id bài thì khoá chống farm điểm sẽ chặn luôn lần
  khen thứ hai.
- Huy hiệu `@@unique([userId, badgeId])`: trao lại trả **409**. Khen lại thì thưởng XP kèm lời nhắn.
- Không trao tay được huy hiệu tự động (`isManual = false` → 400). Không tự thưởng cho mình (403).
- Audit `gamification.award` chỉ ghi `{classId, badgeCode, xpAmount, hasNote}` — **không tên người,
  không nguyên văn lời nhắn** (INVARIANT #5).

### T10.5 — Redesign khu Quản trị ✅

- `pages/admin/adminUi.ts` **thuần logic, không JSX** (trộn component vào làm eslint
  `react-refresh/only-export-components` kêu 9 cảnh báo). Component ở `AdminHome.tsx`.
- `ROLE_META` / `STATUS_META` / `GROUP_META` + `auditSentence` / `auditChips` / `auditTime`.
- Nhật ký thành câu đọc được, chi tiết là **chip rời chứ không ghép chuỗi** (ghép chuỗi thì bản
  dịch gãy ở ngôn ngữ có trật tự từ khác). `metaJson` mở rộng **tại chỗ**, không modal.
- `GET /admin/overview`: GV+TA / học viên / lớp `active` / khóa `published`.
  **Đếm theo role LẪN ghi danh lớp** — chỉ đếm theo role thì sai nặng: **16/24 tài khoản không mang
  role nào**, các em được tạo rồi thêm thẳng vào lớp. Ai vừa dạy vừa học chỉ tính vào cột giáo viên.

### ✅ QUYẾT ĐỊNH ĐÃ CHỐT (người quyết 2026-08-26) — không bàn lại

1. **Nhật ký KHÔNG tra tên người bị tác động.** Câu mô tả chung là đủ. Đánh đổi PII biến mất:
   `audit_logs` giữ nguyên hình dạng, không join thêm. Tên người THỰC HIỆN vốn đã có sẵn
   (`AuditLogDto.actorName`, backend join từ P6).
   > Tiền đề cũ *"user có thể đã bị xoá"* **SAI** — không có route xoá user
   > (`users.controller.ts` chỉ có `@Delete(':id/roles/:roleKey')`; `UserStatus` =
   > `invited|active|suspended`). Key `user.delete` có trong contracts nhưng không route nào dùng.
2. **BỎ HẲN nhóm `login`.** Không ghi audit đăng nhập, kể cả thất bại. Rate-limit khoá theo danh
   tính (P9) đã chặn ở tầng dưới.
3. Nhóm **`award`** là nhóm thứ 6, thêm cho `gamification.award` — thiết kế gốc chưa biết action này.

---

## NHIỆM VỤ CÒN LẠI

### T10.2 — Mục tiêu chung của lớp

- Giáo viên đặt mục tiêu ("cả lớp hoàn thành 50 bài tuần này") → đạt thì cả lớp nhận huy hiệu chung.
- Biến cạnh tranh thành hợp tác: em giỏi có động cơ giúp em yếu.
- Cần model mới `ClassGoal` (classId, metric, target, periodStart/End, badgeCode).
- **Dùng lại được `weekWindowVn` của T10.1** cho mốc tuần, đừng viết lại.
- Huy hiệu tập thể nên `isManual = false` (hệ thống tự trao khi đạt) — nhưng phải chặn API trao tay
  đụng vào, cơ chế đã có sẵn.

### T10.4 — Streak nhân văn hơn

Streak hiện tại **tàn nhẫn**: nghỉ một ngày mất sạch. Với trẻ con đó là lý do bỏ hẳn.

- **Vé nghỉ phép**: mỗi tháng 2 ngày không mất streak (`StreakFreeze`).
- **Khớp lịch học thật**: lớp học 2 buổi/tuần thì streak không nên tính cuối tuần.
- Lưu ý `APP_TZ_OFFSET_MS` đang hardcode UTC+7.

> ⚠️ **H5 — phải chốt trước khi code.** Model `Class` **KHÔNG có lịch học hằng tuần**, chỉ có
> `startDate`/`endDate`. Nên "khớp lịch học thật" chưa có dữ liệu để dựa vào. Ba hướng:
> (a) thêm trường lịch học vào `Class` (chính xác, cần migration + UI nhập);
> (b) suy từ hoạt động thực tế (`LessonGate`/`LessonProgress` — rẻ, mong manh);
> (c) chỉ làm phần vé nghỉ phép, bỏ phần khớp lịch.
> **Hỏi người trước khi chọn** — đây là quyết định sản phẩm, không phải kỹ thuật.

---

## Cảnh báo thiết kế: gamification làm sai sẽ dạy sai thứ

- **XP theo số lần nộp** → học viên spam nộp để farm điểm. `coding_pass` chỉ cộng khi ĐẠT — **đừng nới ra.**
- **Xếp hạng theo tốc độ/điểm số** → khuyến khích chép bài. Xếp theo nỗ lực.
- **Phần thưởng ngoại tại lấn át hứng thú tự thân**: khi mọi thứ đều có điểm, trẻ ngừng học vì tò mò
  và chỉ học vì điểm. Giữ ở mức **ghi nhận** (huy hiệu, lời khen), không **đổi chác**.

---

## Nợ kỹ thuật đã biết

- **Khu Giảng dạy chưa giới hạn theo giáo viên.** `GET /classes` trả MỌI lớp cho ai có `class.read`;
  quyền hệ thống là global nên `instructor` thao tác được trên mọi lớp. Sửa phải đồng thời
  `GET /classes` + sidebar + hero. **T10.3 đã vá vòng ngoài cho riêng việc trao thưởng, gốc vẫn còn.**
- UI chưa cấp được vai trò giới hạn theo lớp (backend có `UserRole.classId`, FE chỉ gửi `roleKey`).
- Không có nhập CSV / tự đăng ký. Giáo viên KHÔNG tạo được tài khoản (thiếu `user.create`).
- Chưa có email provider → chưa có quên-mật-khẩu.
- `DELETE /classes/:classId/courses/:courseId` trả 404 khi đã gỡ — bấm 2 lần hiện lỗi.
- Chưa có E2E tự động.
- Nhật ký hiện `Huy hiệu helping_hand` (mã thô) thay vì tên huy hiệu — cố ý, người dùng nói câu tóm
  tắt không cần cầu kỳ. Muốn đẹp thì map code→name qua `/gamification/manual-badges`.

---

## Bẫy đã trả giá để biết (đừng lặp lại)

**Mới từ phiên P10:**

- **MỌI quan hệ trỏ tới `Course` đều `onDelete: Cascade`** (`ClassCourse`, `Section`→`Lesson`,
  `Assignment`, `Quiz`, `CodingProblem`, **`Certificate`**). Postgres KHÔNG bao giờ ném P2003 khi
  xóa khóa học, nên mọi nhánh `catch (P2003)` quanh `course.delete` là **code chết**. Đã trả giá:
  `DELETE` một khóa đang gán lớp trả **204** và cuốn theo liên kết lớp + tiến độ học viên, im lặng.
  Bài học chung: **muốn chặn xóa thì phải TỰ ĐẾM, đừng tin khoá ngoại** — kiểm lại các model khác
  trước khi dựa vào FK để bảo vệ dữ liệu.
- **Thêm quyền cho một role cũng KHÔNG tới production qua seed.** Cùng bẫy với dữ liệu hạt giống:
  phải viết migration chèn `role_permissions` (idempotent). Xem
  `20260826180000_instructor_can_delete_course`.
- **`ops/release.sh` KHÔNG chạy seed.** Seed chỉ chạy đúng một lần lúc dựng máy (RUNBOOK §2). Dữ
  liệu hạt giống mới (như 3 huy hiệu trao tay) phải vào bằng **migration**, nếu không nó không bao
  giờ lên tới production và **không có gì báo lỗi cả**.
- **`release.sh` sao lưu ở bước 1, TRƯỚC khi migrate ở bước 3.** File nó tạo là ảnh chụp *trước*
  migration (đúng ý đồ — đó là điểm lùi), nhưng nghĩa là ngay sau khi phát hành bạn **chưa có điểm
  phục hồi cho trạng thái mới**. Chạy `ops/backup.sh` lần nữa sau khi phát hành.
- **`/var/backups` thuộc root 755** nên user `deploy` không tạo được thư mục con → `release.sh` chết
  ngay bước 1. Đã vá `ops/bootstrap-vps.sh`; máy dựng trước bản vá phải làm tay.
- **Máy production KHÔNG cài `cron`** (`crontab: command not found`). RUNBOOK cũ bảo dùng `crontab -e`
  là sai — dùng **systemd timer**, mẫu đầy đủ ở RUNBOOK §5.
- **Hai ảnh Docker build song song, `fail-fast: false`** → có thể một cái xong một cái chưa. Xem §CI/CD.
- **Test qua `curl` trên Git Bash/Windows làm hỏng tiếng Việt trong payload.** Dữ liệu vào DB thành
  `H?m nay con gi?p b?n`. Không phải lỗi ứng dụng — gõ từ giao diện thì UTF-8 chuẩn. Đừng đi sửa
  encoding của app vì thấy chuỗi hỏng trong output của curl.
- **`docker exec` cần cờ `-i`** mới đọc được stdin từ heredoc, nếu không lệnh chạy im lặng không làm gì.
- **`prisma migrate dev` có thể hỏi tương tác** và treo. Áp migration đã viết sẵn thì dùng
  `prisma migrate deploy` — chạy thẳng, không hỏi.

**Từ các phiên trước:**

- `prisma generate` chọn engine theo OpenSSL **dò được lúc build** → phải cài `openssl` ở stage build.
- `COPY --chown=node:node` bắt buộc, nếu không Prisma CLI không ghi được thư mục engine.
- `sshd` đọc `sshd_config.d/*` theo thứ tự chữ cái, **giá trị ĐẦU TIÊN thắng**.
- `STORAGE_DRIVER=local` **bắt buộc** mount `./uploads`, và `backup.sh` phải đóng gói nó.
- `prisma generate` **EPERM** khi API dev đang chạy → tắt API trước khi `pnpm validate`.
- Worktree không có `.env` → API chết lúc boot (đúng thiết kế). Tạo `.env` cục bộ theo `.env.example`.
- Worktree: `pnpm db:up` FAIL vì trùng tên project → dùng `docker start lms-postgres lms-redis`.
- **Piston coi MỌI mục con của `/piston/packages` là một gói ngôn ngữ.** Một file lạc vào đó (kể cả
  `.gitkeep`) làm nó chết `ENOTDIR` và restart vô hạn — dùng **named volume**, đừng bind mount.
- **Ảnh Piston không có `curl`.** Dò từ container `api`:
  `docker compose exec api curl http://piston:2000/api/v2/runtimes`.
- **`mem_limit` của container piston KHÔNG chặn mã học viên.** Thứ chặn thật là `PISTON_RUN_MEMORY_LIMIT`.
- Screenshot của Browser pane timeout khi pane ẩn → dùng `get_page_text` / `read_page` / `javascript_tool`.

---

## Tài khoản dev (DB cục bộ, KHÔNG phải production)

`p7member@codespace.vn` và `p7outsider@codespace.vn`, mật khẩu `Learn123!` — đều là học viên,
không có role hệ thống. `admin@codespace.vn`, `teacher@codespace.vn`, `student1@codespace.vn`
**không đăng nhập được** bằng mật khẩu nào ghi trong tài liệu.

Muốn dựng môi trường thử T10.3: phải có một GV **tạo lớp** (hoặc là thành viên instructor/ta), vì
đó là điều kiện của `assertCanAwardInClass`.

Dữ liệu test của phiên 2026-08-26 **đã dọn sạch** — DB dev về đúng trạng thái trước phiên.

---

## Ràng buộc bất biến

- Giữ `pnpm validate` 16/16 sau MỖI lô; i18n parity vi/en (`node scripts/check-i18n-parity.mjs`).
- Endpoint mới phải khai `@RequirePermission`, ownership kiểm ở service (INVARIANT #3).
  Ngoại lệ có chủ ý: route mà HỌC VIÊN phải gọi được thì kiểm membership trong service thay vì
  gắn permission key của GV/admin (xem T10.1).
- XP / badge / notification / audit ghi **cùng transaction** với sự kiện domain (INVARIANT #6).
- Mọi chuỗi hiển thị qua `t()`, thêm cả vi lẫn en.
- Ngân sách RAM 2 GB vẫn là ràng buộc cứng — đo trước khi thêm.
