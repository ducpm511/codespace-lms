#!/usr/bin/env bash
#
# Phục hồi database từ một file dump của ops/backup.sh.
#
#   ops/restore.sh /var/backups/lms/lms-20260821T021500Z.sql.gz              # thử nghiệm (mặc định)
#   ops/restore.sh /var/backups/lms/lms-...sql.gz --into-production          # ghi đè DB thật
#
# Mặc định phục hồi vào MỘT DATABASE TẠM rồi đếm bản ghi — đó là cách thử backup mà không
# đụng dữ liệu đang chạy. Phải chạy thử ít nhất một lần trước khi mở pilot: một backup chưa
# từng restore chỉ là một file, không phải một bản sao lưu.

set -Eeuo pipefail

archive="${1:-}"
mode="${2:-}"
if [ -z "${archive}" ] || [ ! -f "${archive}" ]; then
  echo "Dùng: $0 <file .sql.gz> [--into-production]" >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-/srv/lms}"
COMPOSE="docker compose -f ${REPO_DIR}/docker-compose.prod.yml --env-file ${REPO_DIR}/.env.production"
PGUSER="${POSTGRES_USER:-lms}"
PGDB="${POSTGRES_DB:-lms}"

if [ "${mode}" = "--into-production" ]; then
  target="${PGDB}"
  echo "!! Sắp GHI ĐÈ database production '${target}'. Ctrl-C trong 10 giây để hủy."
  sleep 10
  # API đang chạy sẽ ghi đè lên dữ liệu vừa phục hồi -> tắt trước.
  ${COMPOSE} stop api
else
  target="restore_check_$(date -u +%Y%m%d%H%M%S)"
  echo "Phục hồi thử vào database tạm '${target}' (KHÔNG đụng '${PGDB}')."
  ${COMPOSE} exec -T postgres createdb --username "${PGUSER}" "${target}"
fi

echo "Đang nạp ${archive} -> ${target}"
gunzip -c "${archive}" | ${COMPOSE} exec -T postgres psql --username "${PGUSER}" --dbname "${target}" -v ON_ERROR_STOP=1 >/dev/null

echo "Kiểm chứng:"
${COMPOSE} exec -T postgres psql --username "${PGUSER}" --dbname "${target}" -c \
  "SELECT (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM classes) AS classes,
          (SELECT count(*) FROM submissions) AS submissions,
          (SELECT count(*) FROM certificates) AS certificates;"

if [ "${mode}" = "--into-production" ]; then
  ${COMPOSE} start api
  echo "Đã phục hồi vào production và bật lại api."
else
  echo
  echo "Số liệu trên phải khớp với hệ thống đang chạy. Xong thì dọn:"
  echo "  ${COMPOSE} exec -T postgres dropdb --username ${PGUSER} ${target}"
fi
