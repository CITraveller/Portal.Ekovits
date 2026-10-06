#!/bin/bash

set -euo pipefail

PROJECT_DIR="/home/ubuntu/Portal.ekovits.com"
BACKUP_ROOT="/home/ubuntu/backups/portal-ekovits"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "Portal.Ekovits Database Backup"
echo "=========================================="
echo "Backup directory: $BACKUP_DIR"

cd "$PROJECT_DIR"

echo
echo "1. Checking PostgreSQL container..."
docker inspect -f '{{.State.Status}} {{.State.Health.Status}}' portal_db

echo
echo "2. Creating PostgreSQL dump..."

docker exec portal_db pg_dump \
  -U portal_app \
  -d ekovits_invoice \
  --format=custom \
  --file="/tmp/portal_backup.dump"

docker cp \
  portal_db:/tmp/portal_backup.dump \
  "${BACKUP_DIR}/portal_backup.dump"

docker exec portal_db rm -f /tmp/portal_backup.dump

echo
echo "3. Verifying backup..."

if [ ! -s "${BACKUP_DIR}/portal_backup.dump" ]; then
    echo "ERROR: Backup file is empty."
    exit 1
fi

echo
echo "4. Compressing backup..."

gzip "${BACKUP_DIR}/portal_backup.dump"

BACKUP_FILE="${BACKUP_DIR}/portal_backup.dump.gz"

if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERROR: Compressed backup is empty."
    exit 1
fi

echo
echo "=========================================="
echo "BACKUP SUCCESSFUL"
echo "=========================================="
echo "File: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo

# Keep the most recent 10 backups
echo "Cleaning old backups..."

find "$BACKUP_ROOT" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -printf '%T@ %p\n' |
sort -nr |
tail -n +11 |
cut -d' ' -f2- |
xargs -r rm -rf

echo "Backup process completed."
