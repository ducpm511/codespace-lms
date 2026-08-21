#!/usr/bin/env bash
#
# Sao lưu database hằng ngày, ĐẨY RA NGOÀI MÁY.
#
# Vì sao không dựa vào backup hằng tuần của nhà cung cấp:
#   1. Mất tối đa 7 ngày dữ liệu — cả một chương học của một lớp.
#   2. Snapshot ổ đĩa của một Postgres ĐANG CHẠY không đảm bảo nhất quán; pg_dump thì có.
#
# Cron (chạy dưới user deploy):
#   15 2 * * * /srv/lms/ops/backup.sh >> /var/log/lms-backup.log 2>&1
#
# BACKUP CHƯA THỬ RESTORE COI NHƯ CHƯA CÓ. Xem ops/restore.sh và docs/RUNBOOK.md.

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/srv/lms}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lms}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE="docker compose -f ${REPO_DIR}/docker-compose.prod.yml --env-file ${REPO_DIR}/.env.production"

# Đích ngoài máy: đường dẫn rclone (vd 'r2:lms-backups'). Bỏ trống thì CHỈ có bản trên máy —
# ổ đĩa chết là mất luôn cả backup, nên script sẽ cảnh báo to.
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${BACKUP_DIR}/lms-${timestamp}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -uIs)] dump -> ${archive}"
# --clean --if-exists: file dump tự dựng lại được trên một database đã có dữ liệu.
${COMPOSE} exec -T postgres \
  pg_dump --username "${POSTGRES_USER:-lms}" --dbname "${POSTGRES_DB:-lms}" --clean --if-exists \
  | gzip -9 > "${archive}.part"
mv "${archive}.part" "${archive}"

size="$(stat -c %s "${archive}")"
# Dump của một database rỗng cũng vài KB; nhỏ hơn ngưỡng này là dump hỏng, đừng để nó
# lặng lẽ thay thế bản tốt hôm qua.
if [ "${size}" -lt 10240 ]; then
  echo "LỖI: file dump chỉ ${size} bytes — nhiều khả năng hỏng. Giữ nguyên bản cũ." >&2
  mv "${archive}" "${archive}.suspect"
  exit 1
fi
echo "[$(date -uIs)] dump xong: ${size} bytes"

if [ -n "${OFFSITE_REMOTE}" ]; then
  echo "[$(date -uIs)] đẩy ra ${OFFSITE_REMOTE}"
  rclone copy "${archive}" "${OFFSITE_REMOTE}/" --checksum
else
  echo "CẢNH BÁO: OFFSITE_REMOTE trống — backup chỉ nằm trên chính VPS này." >&2
fi

# Dọn bản cũ (chỉ trên máy; vòng đời ở đích ngoài đặt bằng chính sách của nhà cung cấp).
find "${BACKUP_DIR}" -name 'lms-*.sql.gz' -mtime "+${KEEP_DAYS}" -delete
echo "[$(date -uIs)] xong"
