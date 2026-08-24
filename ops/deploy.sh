#!/usr/bin/env bash
#
# ĐƯỜNG LUI: phát hành bằng cách BUILD NGAY TRÊN VPS.
#
# Cách thường dùng là `ops/release.sh` — kéo ảnh đã build sẵn trên GHCR, mất ~1 phút.
# Script này chỉ dùng khi GHCR không dùng được (Actions hỏng, repo chuyển private chưa cấu hình
# đăng nhập, hoặc cần thử một thay đổi chưa merge). Nó build trên máy 2 GB: chậm, dựa vào swap,
# và có thể bị OOM-kill ở bước build web.
#
#   ops/deploy.sh
#
# Thứ tự cố ý: build ảnh trước, chạy migrate, rồi mới đổi container. `migrate deploy` chỉ áp
# migration đã có sẵn trong repo — KHÔNG dùng `migrate dev`, nó sinh migration mới và có thể
# hỏi reset database.

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/srv/lms}"
cd "${REPO_DIR}"

# Kèm override build: nếu không, compose sẽ đi tìm ảnh trên GHCR thay vì build tại chỗ.
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.build.yml --env-file .env.production"

echo "== 1/5 Sao lưu trước khi đổi schema =="
# Migration hỏng giữa chừng mà không có bản dump ngay trước đó thì không lùi được.
# Lần deploy ĐẦU TIÊN chưa có gì để sao lưu -> bỏ qua thay vì chết ở dòng đầu.
if ${COMPOSE} ps --status running --services 2>/dev/null | grep -qx postgres; then
  ops/backup.sh
else
  echo "   (postgres chưa chạy — lần deploy đầu, bỏ qua sao lưu)"
fi

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
# Hỏi thẳng docker inspect thay vì bóc chuỗi từ `compose ps --format json`: định dạng JSON đó
# đổi theo phiên bản Compose, còn .State.Health.Status thì không.
healthy=""
for _ in $(seq 1 30); do
  cid="$(${COMPOSE} ps -q api)"
  if [ -n "${cid}" ] && [ "$(docker inspect --format '{{.State.Health.Status}}' "${cid}")" = "healthy" ]; then
    healthy="yes"
    echo "api healthy."
    break
  fi
  sleep 5
done
if [ -z "${healthy}" ]; then
  echo "api KHÔNG healthy sau 150 giây. Xem log:" >&2
  echo "  ${COMPOSE} logs --tail=50 api" >&2
  exit 1
fi

${COMPOSE} ps
echo
echo "Chạy smoke thủ công theo docs/RUNBOOK.md §Smoke sau deploy trước khi báo xong."
