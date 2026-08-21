# RUNBOOK — CodeSpace LMS trên 1 VPS

Máy đích: **Ubuntu 24.04 LTS, 2 vCPU / 2 GB RAM / 30 GB NVMe** (~6.3 USD/tháng).
Trên đó chạy tất cả: Caddy + API + Postgres + Piston. Không có Redis.

Quyết định kiến trúc và ngân sách RAM: `.harness/agent/HANDOFF_P9.md`.

---

## 1. Dựng máy (một lần)

```bash
# trên máy của bạn: nạp khóa công khai cho user deploy TRƯỚC
ssh root@<ip> 'adduser --disabled-password --gecos "" deploy && install -d -m700 -o deploy -g deploy /home/deploy/.ssh'
ssh root@<ip> 'tee /home/deploy/.ssh/authorized_keys' < ~/.ssh/id_ed25519.pub
ssh root@<ip> 'chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 $_'
```

```bash
# trên VPS, bằng root
bash ops/bootstrap-vps.sh deploy
```

Script làm: cập nhật hệ thống, swap 2 GB (`vm.swappiness=10`), `unattended-upgrades`,
ufw chỉ mở 22/80/443, fail2ban cho SSH, tắt đăng nhập bằng mật khẩu, cài Docker,
giới hạn xoay log Docker 10 MB × 3.

> Bước tắt mật khẩu chỉ chạy khi `authorized_keys` đã có nội dung. Nếu bỏ qua bước nạp khóa
> ở trên, script sẽ báo và **không** siết SSH — cố tình như vậy để không tự khóa mình ra ngoài.

---

## 2. Deploy lần đầu

```bash
sudo install -d -o deploy -g deploy /srv/lms
sudo -u deploy git clone <repo> /srv/lms
cd /srv/lms
```

Tạo `/srv/lms/.env.production` (chmod 600, **không commit**) theo `.env.example`. Bắt buộc:

| Biến | Ghi chú |
|---|---|
| `NODE_ENV` | `production` |
| `LMS_DOMAIN` | tên miền đã trỏ A record về IP VPS |
| `LMS_ACME_EMAIL` | email nhận cảnh báo hết hạn chứng chỉ |
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -base64 48`, **hai giá trị khác nhau**, ≥ 32 ký tự |
| `WEB_ORIGIN` | `https://<LMS_DOMAIN>` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | chỉ cho lần seed đầu, xóa khỏi file sau đó |
| `STORAGE_DRIVER` | `cloudinary` (kèm `CLOUDINARY_*`) hoặc `local` |

API **chết ngay lúc boot** nếu thiếu/sai — thông báo liệt kê đủ các biến có vấn đề
(`apps/api/src/config/env.validation.ts`). Đó là hành vi mong muốn, không phải lỗi.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres

# migration + seed lần đầu
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --entrypoint sh api -c \
  'cd /repo/packages/database && ./node_modules/.bin/prisma migrate deploy && node prisma/seed.cjs'

docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Sau khi đăng nhập được bằng tài khoản admin: **xóa `SEED_ADMIN_*` khỏi `.env.production`**
và đổi mật khẩu admin qua UI (menu tài khoản → Đổi mật khẩu).

### Cài runtime cho Piston (một lần)

Piston nằm trên network `internal` (không có đường ra internet) theo HANDOFF_P9 §B, nên phải
mở tạm để tải gói Python:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.piston-install.yml up -d piston
docker compose exec piston sh -c \
  'curl -fsS -X POST http://127.0.0.1:2000/api/v2/packages -H "Content-Type: application/json" \
   -d "{\"language\":\"python\",\"version\":\"3.12.0\"}"'
docker compose -f docker-compose.prod.yml up -d --force-recreate piston
```

Kiểm chứng đã đóng đường ra — lệnh này **phải hỏng**:

```bash
docker compose exec piston sh -c 'curl -m 5 https://example.com' && echo "SAI: Piston vẫn ra được internet"
```

Và kiểm chứng cách ly khỏi database — lệnh này cũng **phải hỏng**:

```bash
docker compose exec piston sh -c 'getent hosts postgres' && echo "SAI: Piston thấy được postgres"
```

---

## 3. Phát hành bản mới

```bash
cd /srv/lms && ops/deploy.sh
```

Thứ tự: backup → `git pull` → build ảnh → `prisma migrate deploy` → đổi container → chờ health.
Luôn `migrate deploy`, **không bao giờ** `migrate dev` (nó sinh migration mới và có thể hỏi
reset database).

### Build ở CI (khi VPS hay bị OOM lúc build)

Bước build web (Vite + Monaco + Pyodide, dist ~47 MB) ngốn hơn 1 GB. Trên 2 GB nó dựa vào swap.
Nếu bước này quá chậm hoặc bị OOM-kill: build ảnh ở GitHub Actions, push lên GHCR, VPS chỉ
`docker compose pull && up -d`. Khi đó bỏ khối `build:` trong `docker-compose.prod.yml` và
trỏ `image:` vào `ghcr.io/<org>/lms-{api,web}:<tag>`.

---

## 4. Smoke sau deploy (bắt buộc, làm tay)

Chưa chạy đủ danh sách này thì **chưa được coi là deploy xong**.

- [ ] `https://<domain>` lên được, chứng chỉ hợp lệ (Caddy tự xin).
- [ ] Đăng nhập bằng tài khoản admin.
- [ ] **Chờ access token hết hạn (`JWT_ACCESS_TTL`, mặc định 15 phút) rồi thao tác tiếp — phải
      tự refresh, KHÔNG bị đá về trang đăng nhập.** Đây là thứ hay vỡ nhất khi đổi hạ tầng:
      cookie refresh là `httpOnly`, `sameSite: lax`, `path=/api/auth`, nên nó chỉ chạy khi web
      và API **cùng origin** — đúng cấu hình Caddy hiện tại.
- [ ] Mở một bài học có PDF → xem được nội dung.
- [ ] Lấy URL thô của file trên Cloudinary (nếu `STORAGE_DRIVER=cloudinary`) và mở bằng cửa sổ
      ẩn danh → **phải không tải được**.
- [ ] Nộp một bài lập trình → nhận điểm THẬT (không phải kết quả stub).
- [ ] Cấp một chứng chỉ → tải PDF về được.
- [ ] Tab Trắc nghiệm và tab Sổ điểm & chứng chỉ mở được, không lỗi console.
- [ ] Sai mật khẩu 6 lần liên tiếp → lần thứ 6 trả 429; tài khoản khác trên cùng đường mạng
      vẫn đăng nhập bình thường.

### Đo RAM thật (điền vào bảng sau lần deploy đầu)

```bash
docker stats --no-stream
```

| Tiến trình | Mục tiêu | Đo lúc nhàn rỗi | Đo lúc 5 học viên nộp bài cùng lúc |
|---|---|---|---|
| postgres | 300–400 MB | _(điền)_ | _(điền)_ |
| api | 250–350 MB | _(điền)_ | _(điền)_ |
| piston | 150 MB / 300 MB đỉnh | _(điền)_ | _(điền)_ |
| caddy | 30 MB | _(điền)_ | _(điền)_ |
| **Tổng (`free -m`)** | ~1.1 GB / ~1.4 GB | _(điền)_ | _(điền)_ |

Cũng đo bằng DevTools: mở một bài lập trình lần đầu (kéo ~37 MB Monaco + Pyodide), rồi tải lại
trang — lần hai phải là `200 (from disk cache)` cho `/monaco/*`, `/pyodide/*`, `/assets/*`.
Không thấy cache nghĩa là cấu hình `Cache-Control` ở `ops/Caddyfile` không có tác dụng, và một
lớp 30 em sẽ kéo ~1.1 GB mỗi buổi.

---

## 5. Sao lưu và phục hồi

`pg_dump` **hằng ngày**, đẩy ra ngoài máy. Backup hằng tuần của nhà cung cấp KHÔNG thay thế
được: mất tối đa 7 ngày dữ liệu, và snapshot ổ đĩa của một Postgres đang chạy không đảm bảo
nhất quán.

```bash
# cấu hình đích ngoài máy (vd Cloudflare R2) rồi đặt cron dưới user deploy
rclone config
crontab -e
# 15 2 * * * OFFSITE_REMOTE=r2:lms-backups /srv/lms/ops/backup.sh >> /var/log/lms-backup.log 2>&1
```

`ops/backup.sh` từ chối thay bản tốt bằng file dump nhỏ bất thường (< 10 KB) — dump hỏng sẽ
được đổi tên thành `.suspect` và script thoát khác 0.

**Phải thử phục hồi ít nhất một lần trước khi mở pilot.** Backup chưa restore thử chỉ là một file:

```bash
ops/restore.sh /var/backups/lms/lms-<timestamp>.sql.gz
# phục hồi vào database TẠM và in số bản ghi users/classes/submissions/certificates
# -> phải khớp với hệ thống đang chạy
```

Phục hồi thật (chỉ khi đã mất dữ liệu): `ops/restore.sh <file> --into-production` — nó tắt
`api` trước rồi bật lại.

---

## 6. Vận hành hằng ngày

```bash
cd /srv/lms
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api   # log ra stdout
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production restart api
```

Log Docker xoay ở 10 MB × 3 mỗi container (đặt trong `ops/bootstrap-vps.sh`), nên 30 GB đĩa
không bị log ăn hết. Mức log của API theo `NODE_ENV`.

### Điều đã đánh đổi, cần biết trước

- **Không có Redis** ⇒ `CODE_QUEUE_DRIVER=inline`: chấm bài chạy ngay trong request.
  **Mất retry tự động của BullMQ** — nếu một lần chấm lỗi (Piston hết giờ, container vừa
  restart), bài đó không được thử lại. Cách xử lý cho học viên: **nộp lại**. Chấm gọi Piston
  qua HTTP nên event loop không bị chặn; chỉ đúng request nộp bài đó chờ lâu hơn.
- **Chưa có email provider** ⇒ chưa có quên-mật-khẩu. Học viên mất mật khẩu thì admin đặt lại
  trong Quản trị → Người dùng → Đặt lại mật khẩu, rồi chuyển mật khẩu mới qua kênh riêng.
  Thao tác này thu hồi mọi phiên của tài khoản đó và ghi AuditLog.
- **Một VPS** ⇒ không có dự phòng. Máy chết là hệ thống chết. Đường phục hồi là backup ngoài
  máy + dựng lại theo mục 1–2, mất khoảng 30–60 phút.

### Khắc phục nhanh

| Hiện tượng | Xử lý |
|---|---|
| API không lên, log in `EnvValidationError` | Thiếu/sai biến trong `.env.production` — thông báo đã liệt kê đủ. |
| Đăng nhập bị 429 | Rate limit `/auth/login`: 5 lần/phút cho mỗi cặp (IP, email), khóa thêm 5 phút. Chờ hoặc admin đặt lại mật khẩu. |
| Bài lập trình không chấm | `docker compose ps piston`; kiểm tra runtime Python đã cài (mục 2). Cho học viên nộp lại. |
| Đĩa đầy | `docker system prune -af --volumes` **KHÔNG dùng** (xóa cả `pgdata`). Dùng `docker image prune -af` và dọn `/var/backups/lms`. |
| Hết RAM | `free -m`, `docker stats`. Điền vào bảng mục 4 rồi so với ngân sách trong `HANDOFF_P9.md`. |
