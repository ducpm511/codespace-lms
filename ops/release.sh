#!/usr/bin/env bash
#
# Phát hành bản mới bằng ảnh đã build sẵn trên GHCR. Chạy trên VPS, user deploy:
#
#   cd /srv/lms && git pull && ops/release.sh
#   LMS_IMAGE_TAG=<commit-sha> ops/release.sh    # ghim đúng một bản (dùng khi cần lùi lại)
#
# Không build gì ở đây — ảnh do .github/workflows/release.yml build mỗi lần merge vào main.
# Mất khoảng 1 phút, thay vì 30-45 phút nếu build trên máy 2 GB.
#
# CHỌN THỜI ĐIỂM: bước đổi container làm API restart. Chấm bài chạy `inline` và KHÔNG có
# retry, nên một học viên đang nộp bài đúng lúc đó sẽ mất lượt chấm và phải nộp lại.
# Đừng phát hành giữa giờ học.

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/srv/lms}"
cd "${REPO_DIR}"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
TAG="${LMS_IMAGE_TAG:-latest}"
export LMS_IMAGE_TAG="${TAG}"

echo "== Phát hành tag: ${TAG} =="

# ── Ghi lại bản đang chạy để còn đường lùi ──────────────────────────────────
previous=""
if cid="$(${COMPOSE} ps -q api 2>/dev/null)" && [ -n "${cid}" ]; then
  # Lấy tag đang chạy từ chính container, không đoán theo file.
  previous="$(docker inspect --format '{{.Config.Image}}' "${cid}" 2>/dev/null || true)"
  [ -n "${previous}" ] && echo "   Bản đang chạy: ${previous}"
fi

# ── Sao lưu trước khi đụng tới schema ───────────────────────────────────────
if ${COMPOSE} ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "== 1/4 Sao lưu database =="
  ops/backup.sh
else
  echo "== 1/4 Sao lưu — bỏ qua (postgres chưa chạy, lần phát hành đầu) =="
fi

echo "== 2/4 Kéo ảnh =="
# Chỉ kéo api + caddy: postgres/piston ghim theo tag riêng, kéo lại là tự ý nâng phiên bản.
${COMPOSE} pull api caddy

echo "== 3/4 Áp migration =="
${COMPOSE} up -d postgres
${COMPOSE} run --rm --entrypoint sh api -c \
  'cd /repo/packages/database && ./node_modules/.bin/prisma migrate deploy'

echo "== 4/4 Đổi container =="
${COMPOSE} up -d

echo "== Chờ health check =="
healthy=""
for _ in $(seq 1 30); do
  cid="$(${COMPOSE} ps -q api)"
  if [ -n "${cid}" ] && [ "$(docker inspect --format '{{.State.Health.Status}}' "${cid}")" = "healthy" ]; then
    healthy="yes"
    break
  fi
  sleep 5
done

if [ -n "${healthy}" ]; then
  echo
  echo "✅ Phát hành xong. Tag đang chạy: ${TAG}"
  ${COMPOSE} ps
  echo
  echo "Dọn ảnh cũ khi cần (an toàn, KHÔNG đụng database):"
  echo "  docker image prune -af"
  exit 0
fi

# ── Không healthy: KHÔNG tự lùi lại. Nói rõ vì sao. ─────────────────────────
echo >&2
echo "❌ api KHÔNG healthy sau 150 giây." >&2
echo >&2
${COMPOSE} logs --tail=40 api >&2 || true
echo >&2
echo "Script KHÔNG tự lùi lại, và đây là lý do: bước 3 đã chạy migration." >&2
echo "Lùi code về bản cũ trong khi schema đã mới có thể làm hỏng thêm dữ liệu." >&2
echo >&2
echo "Đọc log ở trên trước. Thường là thiếu/sai biến trong .env.production —" >&2
echo "thông báo EnvValidationError sẽ liệt kê đủ, sửa rồi chạy lại script này." >&2
if [ -n "${previous}" ]; then
  echo >&2
  echo "Nếu chắc chắn cần quay về bản cũ (migration lần này KHÔNG đổi schema):" >&2
  echo "  LMS_IMAGE_TAG=${previous##*:} ops/release.sh" >&2
  echo >&2
  echo "Nếu migration ĐÃ đổi schema thì phải phục hồi cả database:" >&2
  echo "  ops/restore.sh /var/backups/lms/<file vừa tạo ở bước 1>.sql.gz --into-production" >&2
fi
exit 1
