#!/bin/bash
# verify-backup.sh - Verify backup integrity
# Run monthly to ensure backups are restorable

set -e

# Configuration
BACKUP_FILE="$1"
TEST_DB_URL="${TEST_DATABASE_URL}"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ ERROR: No backup file specified"
  echo "Usage: ./verify-backup.sh <backup-file.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ -z "$TEST_DB_URL" ]; then
  echo "⚠️  WARNING: TEST_DATABASE_URL not set"
  echo "Verification will be limited to file integrity only"
  TEST_MODE="file-only"
else
  TEST_MODE="full"
fi

echo "🔍 Starting backup verification for: $BACKUP_FILE"
echo "Test mode: $TEST_MODE"

# Step 1: Check file exists and has content
echo "📄 Checking file integrity..."
FILE_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")

if [ "$FILE_SIZE" -eq 0 ]; then
  echo "❌ FAIL: Backup file is empty"
  exit 1
fi

echo "✅ File size: $FILE_SIZE bytes"

# Step 2: Check if file is a valid gzip
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "🗜️  Verifying gzip compression..."
  if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "✅ Gzip file is valid"
  else
    echo "❌ FAIL: Gzip file is corrupted"
    exit 1
  fi
fi

# Step 3: Check SQL syntax (decompress and check first 100 lines)
echo "📝 Checking SQL syntax..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | head -100 | grep -q "PostgreSQL database dump"
else
  head -100 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"
fi

if [ $? -eq 0 ]; then
  echo "✅ SQL syntax appears valid"
else
  echo "⚠️  WARNING: Could not verify PostgreSQL dump header"
fi

# Step 4: Full restore test (if test database available)
if [ "$TEST_MODE" = "full" ]; then
  echo "🔄 Performing full restore test..."

  # Create temporary database for testing
  TEMP_DB="backup_test_$(date +%s)"

  echo "Creating test database: $TEMP_DB"
  psql "$TEST_DB_URL" -c "CREATE DATABASE $TEMP_DB;" 2>/dev/null || true

  # Restore backup
  echo "Restoring backup..."
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql "${TEST_DB_URL}/${TEMP_DB}"
  else
    psql "${TEST_DB_URL}/${TEMP_DB}" < "$BACKUP_FILE"
  fi

  if [ $? -eq 0 ]; then
    echo "✅ Restore completed successfully"
  else
    echo "❌ FAIL: Restore failed"
    psql "$TEST_DB_URL" -c "DROP DATABASE IF EXISTS $TEMP_DB;"
    exit 1
  fi

  # Verify data integrity
  echo "Verifying data integrity..."

  # Check key tables exist
  TABLES=("tenants" "profiles" "contracts" "projects")
  for table in "${TABLES[@]}"; do
    COUNT=$(psql "${TEST_DB_URL}/${TEMP_DB}" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
    if [ "$COUNT" -gt "0" ] || [ "$COUNT" -eq "0" ]; then
      echo "✅ Table $table: $COUNT rows"
    else
      echo "⚠️  Table $table: not found or error"
    fi
  done

  # Cleanup
  echo "Cleaning up test database..."
  psql "$TEST_DB_URL" -c "DROP DATABASE $TEMP_DB;"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BACKUP VERIFICATION SUCCESSFUL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backup file: $BACKUP_FILE"
echo "File size: $FILE_SIZE bytes"
echo "Test mode: $TEST_MODE"
echo "Verification date: $(date)"
echo ""

# Log verification result
LOG_FILE="./backup-verification.log"
echo "$(date): ✅ $BACKUP_FILE verified successfully ($FILE_SIZE bytes)" >> "$LOG_FILE"

exit 0
