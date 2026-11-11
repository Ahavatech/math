#!/usr/bin/env bash
#
# Daily backup script for the OAU Mathematics website.
# Backs up PostgreSQL (via pg_dump) and the private storage directory.
#
# Usage:
#   chmod +x deploy/backup-scripts/daily-backup.sh
#   # Add to crontab:
#   # 0 3 * * * /opt/maths-oau/deploy/backup-scripts/daily-backup.sh >> /var/log/maths-oau/backup.log 2>&1
#
# Environment variables (set in the crontab or source from a file):
#   DATABASE_URL          — PostgreSQL connection string
#   PRIVATE_STORAGE_DIR   — path to private manuscript storage (e.g. /var/private-storage)
#   BACKUP_DIR            — local directory for backups (default: /var/backups/maths-oau)
#   BACKUP_RETENTION_DAYS — how many days to keep old backups (default: 14)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/maths-oau}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TODAY_DIR="${BACKUP_DIR}/${TIMESTAMP}"

echo "=== Backup started at $(date -Iseconds) ==="

# Create backup directory
mkdir -p "${TODAY_DIR}"

# -----------------------------------------------------------------------
# 1. PostgreSQL dump
# -----------------------------------------------------------------------
echo "Dumping PostgreSQL..."
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --file="${TODAY_DIR}/db.dump"

DB_SIZE=$(du -h "${TODAY_DIR}/db.dump" | cut -f1)
echo "  Database dump: ${DB_SIZE}"

# -----------------------------------------------------------------------
# 2. Private storage (manuscripts, reviewer reports)
# -----------------------------------------------------------------------
if [ -d "${PRIVATE_STORAGE_DIR}" ]; then
  echo "Archiving private storage..."
  tar czf "${TODAY_DIR}/private-storage.tar.gz" -C "$(dirname "${PRIVATE_STORAGE_DIR}")" "$(basename "${PRIVATE_STORAGE_DIR}")"
  PS_SIZE=$(du -h "${TODAY_DIR}/private-storage.tar.gz" | cut -f1)
  echo "  Private storage archive: ${PS_SIZE}"
else
  echo "  PRIVATE_STORAGE_DIR not found at ${PRIVATE_STORAGE_DIR} — skipping."
fi

# -----------------------------------------------------------------------
# 3. Clean up old backups
# -----------------------------------------------------------------------
echo "Cleaning backups older than ${RETENTION} days..."
DELETED=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime "+${RETENTION}" -not -path "${BACKUP_DIR}" -print -exec rm -rf {} \; | wc -l)
echo "  Removed ${DELETED} old backup(s)."

# -----------------------------------------------------------------------
# 4. Summary
# -----------------------------------------------------------------------
TOTAL_SIZE=$(du -sh "${TODAY_DIR}" | cut -f1)
echo "=== Backup complete at $(date -Iseconds) — ${TOTAL_SIZE} total ==="

# -----------------------------------------------------------------------
# Optional: upload to remote storage
# -----------------------------------------------------------------------
# Uncomment and configure one of these to copy backups offsite:
#
# Backblaze B2 (free 10 GB):
#   b2 sync "${TODAY_DIR}" "b2://maths-oau-backups/${TIMESTAMP}/"
#
# Hetzner Storage Box (rsync over SSH):
#   rsync -az "${TODAY_DIR}/" "uXXXXXX@uXXXXXX.your-storagebox.de:backups/${TIMESTAMP}/"
#
