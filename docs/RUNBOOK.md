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

VPS **không build gì cả** — ảnh đã được GitHub Actions build sẵn và đẩy lên GHCR mỗi lần merge
vào `main` (`.github/workflows/release.yml`). Mở tab **Actions** trên GitHub, thấy job
*Release images* xanh rồi hãy làm bước dưới.

> **Một lần duy nhất: mở quyền đọc cho ảnh.** GHCR đặt package ở chế độ *private* mặc định, kể cả
> khi repo là public. Vào `github.com/ducpm511?tab=packages` → chọn `codespace-lms-api` →
> *Package settings* → **Change visibility** → *Public*. Làm tương tự cho `codespace-lms-web`.
> Không làm bước này thì `docker compose pull` trên VPS sẽ báo `denied` hoặc `not found`.
>
> Nếu muốn giữ ảnh private: tạo GitHub token chỉ có quyền `read:packages`, rồi trên VPS chạy
> `echo <token> | docker login ghcr.io -u ducpm511 --password-stdin` một lần.

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

$C pull                 # kéo ảnh api + web từ GHCR (~650 MB lần đầu)
$C up -d postgres

# migration + seed lần đầu
$C run --rm --entrypoint sh api -c \
  'cd /repo/packages/database && ./node_modules/.bin/prisma migrate deploy && node prisma/seed.cjs'

$C up -d
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

Ba tầng, và **tầng cuối do bạn chọn thời điểm** — không tự động:

| Khi nào | Chạy gì | Ai quyết |
|---|---|---|
| Mở PR | `pnpm validate` + kiểm i18n parity (`ci.yml`) | tự động |
| Merge vào `main` | Build 2 ảnh Docker, đẩy lên GHCR (`release.yml`) | tự động |
| Bạn muốn phát hành | Kéo ảnh + migrate + đổi container | **bạn** |

```bash
cd /srv/lms && git pull && ops/release.sh
```

Mất khoảng 1 phút. Script tự sao lưu database trước khi chạy migration. Luôn `migrate deploy`,
**không bao giờ** `migrate dev` (nó sinh migration mới và có thể hỏi reset database).

> ⚠️ **Đừng phát hành giữa giờ học.** Bước đổi container làm API restart. Chấm bài chạy `inline`
> và KHÔNG có retry, nên học viên nào đang nộp bài đúng lúc đó sẽ mất lượt chấm và phải nộp lại.

### Vì sao merge KHÔNG tự deploy

Hai lý do, cả hai đều là hệ quả của việc chỉ có một máy:

1. Chấm bài không có retry (đánh đổi để bỏ Redis) — restart giữa giờ học là mất bài nộp.
2. `prisma migrate deploy` sẽ chạy không người trông, trên đúng một database duy nhất, không có
   staging để thử trước.

Còn *build* thì tự động, vì nó **không chạm vào production** — hỏng cũng chỉ hỏng trên GitHub.

### Lùi lại bản cũ

Mỗi lần build gắn hai tag: `latest` và commit SHA. Ghim một SHA để quay về:

```bash
LMS_IMAGE_TAG=<commit-sha> ops/release.sh
```

Lấy SHA ở tab Actions, hoặc `git log --oneline` trên `main`.

**Nếu bản lỗi đã chạy migration đổi schema thì lùi code KHÔNG đủ** — phải phục hồi cả database từ
bản dump mà `release.sh` vừa tạo ở bước 1 (xem mục 5). `release.sh` cố tình **không** tự lùi lại vì
lý do này: lùi code trong khi schema đã mới có thể làm hỏng thêm dữ liệu. Khi health fail nó in ra
đúng lệnh cần chạy cho từng tình huống.

### Đường lui: build ngay trên VPS

Khi GHCR không dùng được (Actions hỏng, repo chuyển sang private mà chưa cấu hình đăng nhập, hoặc
cần thử một thay đổi chưa merge):

```bash
ops/deploy.sh
```

Script này thêm `docker-compose.build.yml` để build tại chỗ. Chậm (30–45 phút) và bước build web
ngốn hơn 1 GB RAM trên máy 2 GB — nó dựa vào swap và **có thể bị OOM-kill**. Chỉ dùng khi cần.

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

**Đo thật ngày 2026-08-26** trên VPS TINO (1967 MB RAM), sau khi cài xong runtime Python:

| Tiến trình | Mục tiêu | Nhàn rỗi | 5 lượt chạy code đồng thời | Trần đặt trong compose |
|---|---|---|---|---|
| postgres | 300–400 MB | **62 MB** | 62 MB | 448 MB |
| api | 250–350 MB | **95 MB** | 95 MB | 512 MB |
| piston | 150 MB | **23 MB** | 24 MB | 192 MB |
| caddy | 30 MB | **54 MB** | 54 MB | 96 MB |
| **Tổng máy (`free -m`)** | ~1.1 GB / ~1.4 GB | **579 MB** | **585 MB** | 1967 MB |

Thực tế **thấp hơn dự toán khoảng một nửa**: còn trống ~1.39 GB, swap chưa dùng đến 1 MB.
Đĩa 7.6 GB / 29 GB (28%), phần lớn là ảnh Docker + runtime Piston.

Ba điều rút ra khi đọc bảng này:

- **Tải 5 lượt gần như không nhích RAM** vì `PISTON_MAX_CONCURRENT_JOBS=1` — chúng xếp hàng chứ
  không chạy song song. Mỗi lượt ~850 ms CPU, nên 5 em nộp cùng lúc thì em cuối chờ ~4 giây.
  Đó là đánh đổi cố ý của 2 vCPU, không phải trục trặc.
- **RAM của container `piston` KHÔNG phản ánh mã học viên đang chạy.** Piston dựng cgroup riêng
  cho mỗi lượt, nằm ngoài phần kế toán của container. Thứ thật sự chặn là
  `PISTON_RUN_MEMORY_LIMIT` (128 MB/lượt), không phải `mem_limit: 192m`.
- **Caddy là chỗ chật nhất**: 54 MB trên trần 96 MB (56%). Các service khác đều dưới 20%.
  Nếu sau này bật thêm tính năng cho Caddy thì nới trần của nó trước.

Cũng đo bằng DevTools: mở một bài lập trình lần đầu (kéo ~37 MB Monaco + Pyodide), rồi tải lại
trang — lần hai phải là `200 (from disk cache)` cho `/monaco/*`, `/pyodide/*`, `/assets/*`.
Không thấy cache nghĩa là cấu hình `Cache-Control` ở `ops/Caddyfile` không có tác dụng, và một
lớp 30 em sẽ kéo ~1.1 GB mỗi buổi.

---

## 5. Sao lưu và phục hồi

`pg_dump` **hằng ngày**, đẩy ra ngoài máy. Backup hằng tuần của nhà cung cấp KHÔNG thay thế
được: mất tối đa 7 ngày dữ liệu, và snapshot ổ đĩa của một Postgres đang chạy không đảm bảo
nhất quán.

> ⚠️ **Máy hiện tại KHÔNG có `cron`** (ảnh Ubuntu cloud tối giản; `crontab` báo *command not found*,
> `dpkg -l | grep cron` trả 0). Dùng **systemd timer** thay cho cron — xem bên dưới.
> `rclone` thì ĐÃ cài sẵn (v1.60.1) nhưng chưa có remote nào.

```bash
# 1) cấu hình đích ngoài máy (vd Cloudflare R2) — cần tài khoản, xem H3
rclone config

# 2) đặt lịch bằng systemd timer (KHÔNG dùng crontab: máy này không có cron)
sudo tee /etc/systemd/system/lms-backup.service >/dev/null <<'EOF'
[Unit]
Description=Sao lưu LMS
[Service]
Type=oneshot
User=deploy
Environment=OFFSITE_REMOTE=r2:lms-backups
ExecStart=/srv/lms/ops/backup.sh
EOF

sudo tee /etc/systemd/system/lms-backup.timer >/dev/null <<'EOF'
[Unit]
Description=Sao lưu LMS hằng ngày
[Timer]
OnCalendar=*-*-* 02:15:00
Persistent=true
[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload && sudo systemctl enable --now lms-backup.timer
systemctl list-timers lms-backup.timer   # kiểm tra đã lên lịch
```

**Thư mục sao lưu phải tồn tại và thuộc `deploy`.** `/var/backups` thuộc root 755 nên `deploy`
không tự tạo được thư mục con — `ops/release.sh` sẽ chết ngay ở bước 1. `ops/bootstrap-vps.sh`
tạo sẵn `/var/backups/lms` (chmod 700), nhưng máy dựng trước bản vá đó thì phải làm tay:

```bash
sudo mkdir -p /var/backups/lms && sudo chown deploy:deploy /var/backups/lms && sudo chmod 700 /var/backups/lms
```

`ops/backup.sh` từ chối thay bản tốt bằng file dump nhỏ bất thường (< 10 KB) — dump hỏng sẽ
được đổi tên thành `.suspect` và script thoát khác 0.

**✅ Đã thử phục hồi thật ngày 2026-08-26** (chế độ mặc định, phục hồi vào database tạm, KHÔNG
đụng DB đang chạy). Kết quả trên bản sau P10: 39 bảng, 11 migration, 9 huy hiệu (3 trao tay),
43 permission, đủ 6 cột P10, có index `xp_events_classId_createdAt_idx` — khớp bản đang chạy.

> **Bẫy:** `ops/release.sh` sao lưu ở **bước 1, TRƯỚC khi migrate ở bước 3**. Nên file nó tạo ra là
> ảnh chụp **trước** migration — đúng ý đồ (đó là điểm lùi), nhưng nghĩa là ngay sau khi phát hành
> bạn **chưa có điểm phục hồi cho trạng thái mới**. Chạy `ops/backup.sh` một lần nữa sau khi
> phát hành xong.

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
