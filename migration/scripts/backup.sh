#!/usr/bin/env bash

# ─────────────────────────────────────────────────────────────────────────────
# Automated Database Backup Script for Logistel Platform
# ─────────────────────────────────────────────────────────────────────────────

BACKUP_DIR="/var/backups/logistel"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL database backup..."

# Execute pg_dump inside logistel_db container and gzip output
docker compose exec -T postgres pg_dump -U logistel_user -d logistel_prod | gzip > "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup successfully created: ${BACKUP_FILE}"
else
    echo "[$(date)] ERROR: Backup failed!" >&2
    exit 1
fi

# Clean up backups older than RETENTION_DAYS (14 days) 
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "db_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup process completed."
