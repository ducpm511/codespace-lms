# HANDOFF — P10: Gamification giai đoạn 2 + Admin redesign

> Bối cảnh: P0–P9 ✅ xong, **hệ thống đã deploy và đang chạy thật**.

---

## PHẦN A — Trạng thái production (đọc trước khi code)

- URL: **https://lms.codespace.edu.vn** (TLS Let's Encrypt, hạn 22/11/2026, Caddy tự gia hạn)
- VPS: TINO, `103.142.27.54`, Ubuntu 24.04, 2 vCPU / 1.9 GB / 29 GB
- Vào máy: `ssh deploy@103.142.27.54` (chỉ key; `sudo` không cần mật khẩu; root SSH đã tắt).
  Mất key → **Console/VNC của TINO**.
- Repo trên máy: `/srv/lms`. Secret ở `/srv/lms/.env.production` (chmod 600).
- Admin: `ducpm@codespace.edu.vn` — Phạm Minh Đức, super_admin.
- 4 container: caddy / api / postgres / piston. `STORAGE_DRIVER=local`, `CODE_QUEUE_DRIVER=inline`.
- Frappe LMS cũ đã bị cắt DNS (chủ ý). Quay lại: tạo lại CNAME `lms` →
  `lms-tig-dyd.s.frappe.cloud.` **Đừng huỷ tài khoản Frappe vội.**

### CI/CD

| Khi nào | Chạy gì | Ai quyết |
|---|---|---|
| Mở PR | `pnpm validate` + i18n parity | tự động |
| Merge `main` | Build 2 ảnh → GHCR (public) | tự động |
| Phát hành | `cd /srv/lms && git pull && ops/release.sh` (~1 phút) | **người** |

Không tự deploy khi merge: chấm bài `inline` không có retry, restart giữa giờ học là mất bài nộp.

### Việc vận hành

✅ **Piston chạy được, chấm code thật.** Python 3.12.0 đã cài (named volume `piston_packages`).
Đã kiểm chứng: chạy code có stdin ra đúng kết quả; lỗi cú pháp trả stderr không làm sập gì;
vòng lặp vô tận bị SIGKILL sau ~3 s. Cách ly §B đạt cả ba: không ra được internet, không thấy
`postgres`, không map cổng ra host.

✅ **Đã đo RAM thật** — bảng đầy đủ ở RUNBOOK §4. Tóm tắt: dùng **579 MB / 1967 MB** lúc nhàn rỗi,
**585 MB** khi 5 lượt chạy code đồng thời, swap chưa chạm. **Còn trống ~1.39 GB** — P10 có rất
nhiều chỗ. Chật nhất là caddy (54/96 MB).

⚠️ **CÒN LẠI:**

1. **Chưa chạy smoke đầy đủ** RUNBOOK §4 — cần làm qua giao diện thật: chờ token hết hạn xem có
   tự refresh không, nộp bài lập trình **qua UI** (mới chỉ test thẳng vào Piston), tải PDF chứng chỉ.
2. **Chưa có sao lưu ngoài máy** + **chưa thử `ops/restore.sh` lần nào**.
3. **Chưa đổi mật khẩu admin** (mật khẩu seed đã lộ trong hội thoại cũ); chưa xoá `SEED_ADMIN_*`.

---

## PHẦN B — Gamification hiện có (nền để xây tiếp)

| Cơ chế | Hiện trạng | File |
|---|---|---|
| XP | `XpEvent` cộng dồn, **500 XP = 1 level** | `gamification.service.ts:37` |
| Nguồn XP | Đúng **3**: `lesson_complete`, `quiz_pass`, `coding_pass` | classes / quiz / autograder service |
| Streak | Theo ngày, **múi giờ VN cứng UTC+7** (`APP_TZ_OFFSET_MS`) | `gamification.service.ts:7` |
| Badge | 6 cái, seed theo `code`, tiêu chí tự động | `seed.cjs` §BADGE_DEFS |
| Hiển thị | Vòng level hero Learn, chip streak header, chuông thông báo | `LearnHome`, `AppLayout` |

Ghi XP + badge + notification đều nằm **trong cùng transaction** với sự kiện domain — giữ nguyên
kiểu đó cho mọi thứ thêm mới (INVARIANT #6).

---

## NHIỆM VỤ P10

### T10.1 — Bảng xếp hạng theo LỚP, theo TUẦN

- `GET /classes/:classId/leaderboard?week=current|previous` → xếp hạng XP trong tuần của **thành
  viên lớp đó**, kèm thứ hạng của chính mình.
- **Phạm vi là lớp, không phải toàn hệ thống.** Lớp 15–30 em thì thứ hạng còn có ý nghĩa; xếp
  hạng toàn trường thì em yếu vĩnh viễn ở đáy và bỏ cuộc.
- **Reset mỗi thứ Hai** (giờ VN). Bảng tích luỹ vĩnh viễn thì em vào sau không bao giờ đuổi kịp.
- Dữ liệu đã đủ: `XpEvent.createdAt` + `ClassMember`. **Không cần bảng mới.** Nhưng `XpEvent`
  chưa có `classId` → phải quyết: thêm cột (chính xác, cần migration + backfill) hay suy ra từ
  `sourceId` (rẻ hơn, mong manh). **Khuyến nghị: thêm cột.**
- Chỉ số xếp hạng nên là **nỗ lực** (số bài hoàn thành, streak), KHÔNG phải điểm số hay tốc độ —
  xếp theo tốc độ là khuyến khích chép bài.
- Cần index `XpEvent(userId, createdAt)`; nhớ ngân sách 2 GB.

### T10.2 — Mục tiêu chung của lớp

- Giáo viên đặt mục tiêu ("cả lớp hoàn thành 50 bài tuần này") → đạt thì cả lớp nhận huy hiệu chung.
- Biến cạnh tranh thành hợp tác: em giỏi có động cơ giúp em yếu.
- Cần model mới `ClassGoal` (classId, metric, target, periodStart/End, badgeCode).

### T10.3 — Giáo viên trao thưởng thủ công

- **Đây là hướng rẻ nhất mà tác động mạnh nhất**: với trẻ 7–16, lời khen từ cô giáo có sức nặng
  hơn con số tự động. Hiện giáo viên đứng hoàn toàn ngoài hệ thống điểm thưởng.
- Trao huy hiệu tay: "Giúp bạn", "Câu hỏi hay", "Tiến bộ vượt bậc".
- Thưởng XP kèm lời nhắn ngay ở màn hình chấm bài (đã có sẵn).
- Cần: `Badge.isManual`, `UserBadge.awardedById` + `note`; endpoint `POST /users/:id/badges`
  quyền `grade.write` **scope theo lớp** (INVARIANT #3 — không cho trao xuyên lớp).
- Ghi AuditLog cùng transaction.

### T10.4 — Streak nhân văn hơn

Streak hiện tại **tàn nhẫn**: nghỉ một ngày mất sạch. Với trẻ con đó là lý do bỏ hẳn.

- **Vé nghỉ phép**: mỗi tháng 2 ngày không mất streak (`StreakFreeze`).
- **Khớp lịch học thật**: lớp học 2 buổi/tuần thì streak không nên tính cuối tuần — nếu không
  nó chỉ đo "ai được bố mẹ cho dùng máy hằng ngày".
- Lưu ý `APP_TZ_OFFSET_MS` đang hardcode UTC+7.

### T10.5 — Áp design mới cho khu Quản trị

Mẫu: **`apps/web/design_handoff_lms_ui/CodeSpace-LMS-admin-v2.html`** (mở thẳng bằng trình duyệt).
Vẫn theo `README.md` + `nocturne-tokens.css` như các phase trước — **không tự chế style**.

Những gì mẫu đổi so với `AdminHome.tsx` hiện tại:

- **Hai tab `.seg-opt`**: "Người dùng & vai trò" (`ph-users-three`) và "Nhật ký" (`ph-shield-check`).
- **`ROLE_META`**: mỗi vai trò có nhãn + icon Phosphor **fill** + màu riêng
  (super_admin = `ph-crown-simple` / `--cx-coral`; admin = `ph-shield-check` / `--cx-purple`;
  instructor = `ph-chalkboard-teacher`…). Hiện đang render text trơn.
- **`STATUS_META`**: trạng thái cũng thành chip có icon + màu ("Đã khóa" = `ph-prohibit`).
- **Nhật ký viết thành CÂU ĐỌC ĐƯỢC**: "Tạo tài khoản Quân Phạm với vai trò Trợ giảng" thay cho
  `user.create / User / cmt2glny...`. Thời gian tương đối ("Hôm nay · 09:41"), `meta` mở rộng được.
- **Nhóm hành động** để tô màu/icon: `create | update | delete | assign | reset | login`.

### ✅ ĐÃ CHỐT (2026-08-26, người quyết) — không bàn lại

1. **Câu tóm tắt: KHÔNG tra tên người, KHÔNG thêm PII.** Câu mô tả chung là đủ — "Tạo tài khoản với
   vai trò Trợ giảng" thay vì "Tạo tài khoản Quân Phạm với vai trò Trợ giảng". Dựng ở FE từ
   `action` + `entity` + `metaJson` sẵn có. Đánh đổi PII **biến mất hoàn toàn**: không join, không
   snapshot tên, `audit_logs` giữ nguyên hình dạng.
   > Ghi chú: tiền đề cũ "user có thể đã bị xoá" **sai** — không có route xoá user
   > (`users.controller.ts` chỉ có `@Delete(':id/roles/:roleKey')`; `UserStatus` =
   > `invited|active|suspended`). Key `user.delete` có trong contracts nhưng không route nào dùng.

2. **BỎ HẲN nhóm `login`.** Không đụng gì tới auth, không ghi audit đăng nhập (kể cả thất bại).
   Bảng màu/icon của thiết kế bỏ nhóm này. Đổi lại: admin không thấy dấu hiệu dò mật khẩu —
   chấp nhận, vì rate-limit khoá theo danh tính (P9) đã chặn ở tầng dưới.

3. **THÊM YÊU CẦU MỚI — dãy số liệu ở khu Quản trị.** Người dùng muốn khu Quản trị hiển thị số liệu
   tổng quan, quan trọng hơn cả câu tóm tắt nhật ký: **số tài khoản giáo viên**, **số tài khoản học
   viên**, **số lớp đang mở**, **số khóa học đang chạy**. Cần endpoint gộp (kiểu
   `GET /admin/overview`, theo mẫu `GET /teach/overview` của T9.4 — đếm bằng query cố định, đừng nạp
   hết rồi đếm ở client). Đối chiếu lại với mẫu `CodeSpace-LMS-admin-v2.html` khi code.

---

## Cảnh báo thiết kế: gamification làm sai sẽ dạy sai thứ

- **XP theo số lần nộp** → học viên spam nộp để farm điểm. Hiện `coding_pass` chỉ cộng khi ĐẠT —
  **đừng nới ra.**
- **Xếp hạng theo tốc độ/điểm số** → khuyến khích chép bài. Xếp theo nỗ lực.
- **Phần thưởng ngoại tại lấn át hứng thú tự thân**: khi mọi thứ đều có điểm, trẻ ngừng học vì
  tò mò và chỉ học vì điểm. Giữ ở mức **ghi nhận** (huy hiệu, lời khen), không **đổi chác**.

---

## Nợ kỹ thuật đã biết (không chặn P10)

- **Khu Giảng dạy chưa giới hạn theo giáo viên.** `GET /classes` trả MỌI lớp cho ai có
  `class.read`; quyền hệ thống là global nên `instructor` thao tác được trên mọi lớp. Sửa phải
  đồng thời `GET /classes` + sidebar + hero. **T10.1/T10.3 đụng đúng vùng này — cân nhắc gộp.**
- UI chưa cấp được vai trò giới hạn theo lớp (backend có `UserRole.classId`, FE chỉ gửi `roleKey`).
- Không có nhập CSV / tự đăng ký. Giáo viên KHÔNG tạo được tài khoản (thiếu `user.create`).
- Chưa có email provider → chưa có quên-mật-khẩu.
- `DELETE /classes/:classId/courses/:courseId` trả 404 khi đã gỡ — bấm 2 lần hiện lỗi.
- Chưa có E2E tự động.

## Bẫy đã trả giá để biết (đừng lặp lại)

- `prisma generate` chọn engine theo OpenSSL **dò được lúc build** → phải cài `openssl` ở stage
  build, không chỉ runtime.
- `COPY --chown=node:node` bắt buộc, nếu không Prisma CLI không ghi được thư mục engine.
- `sshd` đọc `sshd_config.d/*` theo thứ tự chữ cái, **giá trị ĐẦU TIÊN thắng** — ảnh Ubuntu cloud
  có `60-cloudimg-settings.conf` bật `PasswordAuthentication yes`.
- `STORAGE_DRIVER=local` **bắt buộc** mount `./uploads`, và `backup.sh` phải đóng gói nó.
- `prisma generate` EPERM khi API dev đang chạy → tắt API trước khi `pnpm validate`.
- Worktree không có `.env` → API chết lúc boot (đúng thiết kế). Tạo `.env` cục bộ theo `.env.example`.
- **Piston coi MỌI mục con của `/piston/packages` là một gói ngôn ngữ.** Một file lạc vào đó (kể cả
  `.gitkeep`) làm nó chết `ENOTDIR` và restart vô hạn — và không có gì báo động, vì API chỉ gọi
  Piston khi có học viên nộp bài. Đó là lý do dùng **named volume**, đừng bind mount thư mục repo.
- **Ảnh Piston không có `curl`.** Dò nó từ container `api`:
  `docker compose exec api curl http://piston:2000/api/v2/runtimes` — cũng đúng đường API dùng thật.
- **`mem_limit` của container piston KHÔNG chặn mã học viên** (Piston dùng cgroup riêng ngoài
  container). Thứ chặn thật là `PISTON_RUN_MEMORY_LIMIT`.

## Ràng buộc bất biến

- Giữ `pnpm validate` 16/16 sau MỖI lô; i18n parity vi/en (`node scripts/check-i18n-parity.mjs`).
- Endpoint mới phải khai `@RequirePermission`, ownership kiểm ở service (INVARIANT #3).
- XP / badge / notification / audit ghi **cùng transaction** với sự kiện domain (INVARIANT #6).
- Mọi chuỗi hiển thị qua `t()`, thêm cả vi lẫn en.
- Ngân sách RAM 2 GB vẫn là ràng buộc cứng — đo trước khi thêm.
