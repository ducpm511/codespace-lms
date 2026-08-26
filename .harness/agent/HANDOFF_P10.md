# HANDOFF — sau P9: hệ thống ĐANG CHẠY THẬT

## Trạng thái

**P0–P9 ✅ xong. Đã deploy production và sống.**

- URL: **https://lms.codespace.edu.vn** (TLS Let's Encrypt, hạn 22/11/2026, Caddy tự gia hạn)
- VPS: TINO, `103.142.27.54`, Ubuntu 24.04, 2 vCPU / 1.9 GB / 29 GB
- Vào máy: `ssh deploy@103.142.27.54` (chỉ key; `sudo` không cần mật khẩu; root SSH đã tắt).
  Mất key → **Console/VNC của TINO**.
- Repo trên máy: `/srv/lms`, `main` = `6fc4b89`. Secret ở `/srv/lms/.env.production` (chmod 600).
- Admin: `ducpm@codespace.edu.vn` — Phạm Minh Đức, super_admin.
- 4 container chạy: caddy / api / postgres / piston. `STORAGE_DRIVER=local`, `CODE_QUEUE_DRIVER=inline`.
- Frappe LMS cũ đã bị cắt DNS (chủ ý). Muốn quay lại: tạo lại CNAME `lms` →
  `lms-tig-dyd.s.frappe.cloud.` Tài khoản Frappe vẫn còn, **đừng huỷ vội**.

## CI/CD

| Khi nào | Chạy gì | Ai quyết |
|---|---|---|
| Mở PR | `pnpm validate` + i18n parity | tự động |
| Merge `main` | Build 2 ảnh → GHCR (public) | tự động |
| Phát hành | `cd /srv/lms && git pull && ops/release.sh` (~1 phút) | **người** |

Không tự deploy khi merge: chấm bài chạy `inline` không có retry, restart giữa giờ học là mất
bài nộp; và migration sẽ chạy không người trông trên đúng một database.

## CÒN LẠI — làm trước khi mở lớp thật

1. **Piston chưa có runtime Python** → bài lập trình CHƯA chấm được. Xem `docs/RUNBOOK.md` §2
   "Cài runtime cho Piston", kèm 2 lệnh kiểm chứng Piston không ra được internet và không thấy
   Postgres (HANDOFF_P9 §B).
2. **Chưa chạy smoke** `docs/RUNBOOK.md` §4 — quan trọng nhất: chờ token hết hạn xem có tự
   refresh không; nộp bài lập trình nhận điểm THẬT; cấp chứng chỉ tải PDF.
3. **Chưa đo RAM thật** — bảng trống ở RUNBOOK §4, điền bằng `docker stats`.
4. **Chưa có sao lưu ngoài máy** — cần `rclone config` rồi đặt cron (RUNBOOK §5).
   **Phải thử `ops/restore.sh` một lần.**
5. **Chưa đổi mật khẩu admin** (mật khẩu seed đã lộ trong hội thoại cũ). Xoá `SEED_ADMIN_*`
   khỏi `.env.production` sau đó.

## Nợ kỹ thuật đã biết

- **Khu Giảng dạy chưa giới hạn theo giáo viên.** `GET /classes` trả MỌI lớp cho bất kỳ ai có
  `class.read`, và quyền hệ thống là global nên `instructor` thao tác được trên mọi lớp.
  Sửa phải đồng thời `GET /classes` + sidebar + hero, và quyết trước xem admin không dạy lớp
  nào thì quản lý lớp ở đâu.
- **UI chưa cấp được vai trò giới hạn theo lớp.** Backend có `UserRole.classId`, FE chỉ gửi
  `roleKey` → chỉ cấp được vai trò toàn hệ thống.
- **Không có nhập CSV / tự đăng ký.** Lớp 30 em = 30 lần tạo tài khoản + 30 lần thêm vào lớp,
  làm tay. Giáo viên KHÔNG tạo được tài khoản (`instructor` thiếu `user.create`).
- **Chưa có email provider** → chưa có quên-mật-khẩu. Admin đặt lại thủ công.
- `DELETE /classes/:classId/courses/:courseId` trả 404 khi đã gỡ — bấm 2 lần hiện lỗi.
- Chưa có E2E tự động.

## Bẫy đã trả giá để biết (đừng lặp lại)

- `prisma generate` chọn engine theo OpenSSL **dò được lúc build** → phải cài `openssl` ở stage
  build, không chỉ runtime.
- `COPY --chown=node:node` bắt buộc, nếu không Prisma CLI không ghi được thư mục engine.
- `sshd` đọc `sshd_config.d/*` theo thứ tự chữ cái và **giá trị ĐẦU TIÊN thắng** — ảnh Ubuntu
  cloud có `60-cloudimg-settings.conf` bật `PasswordAuthentication yes`.
- `STORAGE_DRIVER=local` **bắt buộc** mount `./uploads`, và `backup.sh` phải đóng gói nó —
  pg_dump không chứa PDF.
- `prisma generate` EPERM khi API dev đang chạy → tắt API trước khi `pnpm validate`.
- Worktree không có `.env` → API chết lúc boot (đúng thiết kế). Tạo `.env` cục bộ theo `.env.example`.

## Việc tiếp theo đang bàn

**Gamification giai đoạn 2.** Hiện có: XP (`XpEvent`, 500 XP/level), streak theo ngày (giờ VN,
UTC+7), 6 badge, thông báo in-app. Nguồn XP mới chỉ 3: `lesson_complete`, `quiz_pass`,
`coding_pass`. Chưa có bảng xếp hạng, chưa có phần thưởng theo lớp, chưa có gì cho giáo viên
điều khiển. Xem hội thoại brainstorm để biết hướng đã bàn.
