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
  cat > /etc/ssh/sshd_config.d/99-lms.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
EOF
  systemctl reload ssh
  echo "   -> đã tắt đăng nhập bằng mật khẩu."
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

echo
echo "Xong. Bước tiếp theo: docs/RUNBOOK.md (deploy lần đầu)."
