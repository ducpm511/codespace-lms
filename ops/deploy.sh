#!/usr/bin/env bash
#
# Phát hành một phiên bản mới lên VPS. Chạy trên VPS, bằng user deploy, trong /srv/lms:
#   ops/deploy.sh
#
# Thứ tự cố ý: build ảnh trước, chạy migrate, rồi mới đổi container. `migrate deploy` chỉ áp
# migration đã có sẵn trong repo — KHÔNG dùng `migrate dev`, nó sinh migration mới và có thể
# hỏi reset database.

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/srv/lms}"
cd "${REPO_DIR}"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "== 1/5 Sao lưu trước khi đổi schema =="
# Migration hỏng giữa chừng mà không có bản dump ngay trước đó thì không lùi được.
ops/backup.sh

echo "== 2/5 Lấy code mới =="
git pull --ff-only

echo "== 3/5 Build ảnh =="
# Bước build web ngốn >1 GB (Monaco + Pyodide). Trên 2 GB nó dựa vào swap — chậm nhưng chạy.
# Nếu hay OOM: build ở CI rồi push image, VPS chỉ pull (xem docs/RUNBOOK.md §Build ở CI).
${COMPOSE} build

echo "== 4/5 Áp migration =="
${COMPOSE} up -d postgres
${COMPOSE} run --rm --entrypoint sh api -c \
  'cd /repo/packages/database && ./node_modules/.bin/prisma migrate deploy'

echo "== 5/5 Đổi container =="
${COMPOSE} up -d

echo "== Chờ health check =="
for _ in $(seq 1 30); do
  if [ "$(${COMPOSE} ps --format json api | grep -c '"Health":"healthy"')" -ge 1 ]; then
    echo "api healthy."
    break
  fi
  sleep 5
done

${COMPOSE} ps
echo
echo "Chạy smoke thủ công theo docs/RUNBOOK.md §Smoke sau deploy trước khi báo xong."
