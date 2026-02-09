#!/bin/bash
# daily-backup.sh - Automated daily database backup script
# Schedule: Run daily at 3:00 AM UTC via cron or GitHub Actions

set -e  # Exit on error

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="alphaclone-backup-${DATE}.sql"
RETENTION_DAYS=7

# Supabase connection (from environment variables)
DB_URL="${DATABASE_URL}"

if [ -z "$DB_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  exit 1
fi

echo "🔄 Starting backup at $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform database dump
echo "📦 Creating database backup..."
pg_dump "$DB_URL" > "${BACKUP_DIR}/${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  echo "✅ Backup created successfully: ${BACKUP_FILE}"
else
  echo "❌ Backup failed!"
  exit 1
fi

# Compress backup
echo "🗜️  Compressing backup..."
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  echo "✅ Backup compressed: ${BACKUP_FILE}.gz"
else
  echo "⚠️  Compression failed, but backup exists"
fi

# Check backup file size
BACKUP_SIZE=$(stat -f%z "${BACKUP_DIR}/${BACKUP_FILE}.gz" 2>/dev/null || stat -c%s "${BACKUP_DIR}/${BACKUP_FILE}.gz")
MIN_SIZE=100000  # 100 KB minimum

if [ "$BACKUP_SIZE" -lt "$MIN_SIZE" ]; then
  echo "⚠️  WARNING: Backup file is suspiciously small: $BACKUP_SIZE bytes"
  echo "This may indicate a problem with the backup"
fi

# Optional: Upload to cloud storage (uncomment and configure)
# echo "☁️  Uploading to S3..."
# aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" "s3://your-backup-bucket/backups/${BACKUP_FILE}.gz"

# Optional: Upload to Google Cloud Storage
# gsutil cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" "gs://your-backup-bucket/backups/${BACKUP_FILE}.gz"

# Clean up old backups (keep last N days)
echo "🧹 Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "alphaclone-backup-*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/alphaclone-backup-*.sql.gz 2>/dev/null | wc -l)
echo "📊 Total backups retained: $BACKUP_COUNT"

echo "✅ Backup process completed successfully at $(date)"
echo "Backup location: ${BACKUP_DIR}/${BACKUP_FILE}.gz"
echo "Backup size: $BACKUP_SIZE bytes"

# Optional: Send notification (uncomment and configure)
# curl -X POST https://your-webhook-url \
#   -H "Content-Type: application/json" \
#   -d "{\"text\": \"✅ Database backup completed: ${BACKUP_FILE}.gz ($BACKUP_SIZE bytes)\"}"

exit 0
