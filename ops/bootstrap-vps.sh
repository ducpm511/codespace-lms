#!/usr/bin/env bash
#
# Dựng VPS Ubuntu 24.04 LTS trắng thành máy chạy được CodeSpace LMS.
# Chạy MỘT LẦN, bằng root, trên máy mới:
#
#   curl -fsSLO https://raw.githubusercontent.com/<org>/<repo>/main/ops/bootstrap-vps.sh
#   bash bootstrap-vps.sh <ten-user-deploy>
#
# Script này KHÔNG deploy ứng dụng — xem docs/RUNBOOK.md cho bước đó.

set -Eeuo pipefail

DEPLOY_USER="${1:-deploy}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Phải chạy bằng root." >&2
  exit 1
fi

echo "== Cập nhật hệ thống =="
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git ufw fail2ban unattended-upgrades rclone

echo "== Swap ${SWAP_SIZE} =="
# 2 GB RAM là sát nút: bước build web (vite + Monaco) và các đỉnh tải sẽ bị OOM-kill nếu
# không có swap. Swap ở đây là lưới an toàn, không phải để chạy thường xuyên trên đó.
if [ ! -f /swapfile ]; then
  fallocate -l "${SWAP_SIZE}" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Ưu tiên giữ trong RAM, chỉ tràn sang swap khi thật sự cần.
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-lms-swap.conf
fi

echo "== Vá bảo mật tự động =="
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Tường lửa: chỉ 22/80/443 =="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== fail2ban cho SSH =="
cat > /etc/fail2ban/jail.d/lms-sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban

echo "== SSH: chỉ dùng key =="
# Chỉ siết khi user deploy ĐÃ có khóa công khai — nếu không sẽ tự khóa mình ra ngoài.
if [ -s "/home/${DEPLOY_USER}/.ssh/authorized_keys" ]; then
  # Tên file phải sắp xếp TRƯỚC file của ảnh cloud. sshd đọc Include theo thứ tự chữ cái và
  # với mỗi từ khoá thì GIÁ TRỊ ĐẦU TIÊN thắng. Ảnh Ubuntu cloud có sẵn
  # /etc/ssh/sshd_config.d/60-cloudimg-settings.conf đặt `PasswordAuthentication yes`, nên đặt
  # tên `99-...` là thua nó — script báo thành công trong khi mật khẩu vẫn đăng nhập được.
  cat > /etc/ssh/sshd_config.d/00-lms.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
EOF
  rm -f /etc/ssh/sshd_config.d/99-lms.conf   # dọn file của bản script cũ, nếu có
  sshd -t
  systemctl reload ssh

  # KIỂM CHỨNG thay vì tin lời mình. `sshd -T` in ra giá trị thực sự có hiệu lực sau khi
  # gộp hết mọi file cấu hình — đây là thứ duy nhất đáng tin.
  if sshd -T | grep -qx 'passwordauthentication no'; then
    echo "   -> đã tắt đăng nhập bằng mật khẩu (đã kiểm chứng bằng sshd -T)."
  else
    echo "   -> LỖI: vẫn còn bật đăng nhập bằng mật khẩu dù đã ghi cấu hình." >&2
    echo "      Có file nào khác trong /etc/ssh/sshd_config.d/ đặt giá trị này trước." >&2
    sshd -T | grep -E '^(passwordauthentication|permitrootlogin)' >&2
    exit 1
  fi
else
  echo "   -> BỎ QUA: /home/${DEPLOY_USER}/.ssh/authorized_keys trống."
  echo "      Nạp khóa công khai trước rồi chạy lại, nếu không bạn sẽ tự khóa mình ra ngoài."
fi

echo "== Docker =="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
id -u "${DEPLOY_USER}" >/dev/null 2>&1 || adduser --disabled-password --gecos '' "${DEPLOY_USER}"
usermod -aG docker "${DEPLOY_USER}"

echo "== Xoay log Docker: 30 GB đĩa không dành cho log =="
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl restart docker

echo "== Thư mục sao lưu =="
# /var/backups thuộc root 755 nên user deploy KHÔNG tự tạo thư mục con được. Thiếu bước này thì
# ops/release.sh chết ngay ở bước 1 ("mkdir: cannot create directory '/var/backups/lms'") — đã
# vấp thật khi phát hành P10. Chmod 700: bản sao lưu chứa toàn bộ dữ liệu học viên.
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lms}"
mkdir -p "${BACKUP_DIR}"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
echo "   -> ${BACKUP_DIR} (chủ sở hữu ${DEPLOY_USER}, chmod 700)"

echo
echo "Xong. Bước tiếp theo: docs/RUNBOOK.md (deploy lần đầu)."
