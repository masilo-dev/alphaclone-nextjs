#!/usr/bin/env bash
# Verify gzip integrity and perform a real restore into a disposable database.
set -Eeuo pipefail

BACKUP_FILE=${1:-}
TEST_DB_URL=${TEST_DATABASE_URL:-}

fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -n "$BACKUP_FILE" ]] || fail "Usage: $0 <backup-file.sql[.gz]>"
[[ -f "$BACKUP_FILE" ]] || fail "Backup file not found: $BACKUP_FILE"
[[ -n "$TEST_DB_URL" ]] || fail "TEST_DATABASE_URL is required for restore verification"
command -v psql >/dev/null || fail "psql is required"

FILE_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
[[ "$FILE_SIZE" -gt 0 ]] || fail "Backup file is empty"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gzip -t "$BACKUP_FILE" || fail "Backup gzip stream is corrupt"
fi

case "$TEST_DB_URL" in
  *\?*) maintenance_url="${TEST_DB_URL%%\?*}/postgres?${TEST_DB_URL#*\?}" ;;
  */*) maintenance_url="${TEST_DB_URL%/*}/postgres" ;;
  *) fail "TEST_DATABASE_URL must be a PostgreSQL URI" ;;
esac

TEMP_DB="backup_verify_${GITHUB_RUN_ID:-local}_$RANDOM"
TEMP_DB=${TEMP_DB//[^a-zA-Z0-9_]/_}
restore_url="${maintenance_url%/postgres}/${TEMP_DB}"

cleanup() {
  if [[ -n "${TEMP_DB:-}" ]]; then
    psql "$maintenance_url" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TEMP_DB\";" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Restoring $BACKUP_FILE ($FILE_SIZE bytes) into temporary database $TEMP_DB"
psql "$maintenance_url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TEMP_DB\";"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gzip -dc "$BACKUP_FILE" | psql "$restore_url" -v ON_ERROR_STOP=1
else
  psql "$restore_url" -v ON_ERROR_STOP=1 < "$BACKUP_FILE"
fi

for table in tenants profiles contracts projects; do
  exists=$(psql "$restore_url" -v ON_ERROR_STOP=1 -Atc \
    "SELECT to_regclass('public.${table}') IS NOT NULL;")
  [[ "$exists" == "t" ]] || fail "Restored database is missing public.${table}"
  count=$(psql "$restore_url" -v ON_ERROR_STOP=1 -Atc \
    "SELECT count(*) FROM public.\"${table}\";")
  echo "Verified public.${table}: ${count} rows"
done

mkdir -p "$(dirname "${BACKUP_VERIFICATION_LOG:-./backup-verification.log}")"
echo "$(date -u +%FT%TZ): PASS $BACKUP_FILE restored and required tables verified ($FILE_SIZE bytes)" \
  >> "${BACKUP_VERIFICATION_LOG:-./backup-verification.log}"
echo "Backup restore verification passed."
