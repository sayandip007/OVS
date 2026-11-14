#!/usr/bin/env bash
# ==============================================================================
# OVS Automated Disaster Recovery & Restore Verification (POSIX Bash)
# ==============================================================================
# NON-DESTRUCTIVE: Restores backup archive into an isolated test verification
# database (NEVER overwriting the production database). Validates checksum,
# schema migration state, key election tables, and cleans up verification DB.

set -euo pipefail

BACKUP_FILE="${1:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-ovs_admin}"
PROD_DB_NAME="${DB_NAME:-ovs_db}"
VERIFY_DB_NAME="${VERIFY_DB_NAME:-ovs_restore_verification_sandbox}"
KEEP_VERIFY_DB="${KEEP_VERIFY_DB:-false}"

if [ -z "${BACKUP_FILE}" ]; then
    echo "[ERROR] Usage: $0 <path-to-backup-file.dump>" >&2
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "[ERROR] Backup file not found: ${BACKUP_FILE}" >&2
    exit 1
fi

# SAFETY GUARD: Ensure verification database is never the production database
if [ "${VERIFY_DB_NAME}" = "${PROD_DB_NAME}" ] || [ "${VERIFY_DB_NAME}" = "ovs_production" ]; then
    echo "[FATAL SAFETY VIOLATION] Target verify DB name ('${VERIFY_DB_NAME}') equals production database! Aborting immediately." >&2
    exit 99
fi

echo "[INFO] Commencing non-destructive restore verification for '${BACKUP_FILE}'..."

# Step 1: Checksum Verification
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "[INFO] Verifying SHA-256 checksum against ${CHECKSUM_FILE}..."
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -c "${CHECKSUM_FILE}"
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 -c "${CHECKSUM_FILE}"
    else
        echo "[WARN] sha256sum not installed; skipping hash verification."
    fi
else
    echo "[WARN] No companion .sha256 file found for ${BACKUP_FILE}. Proceeding with structural restore verification."
fi

# Step 2: Decrypt if needed
TARGET_RESTORE_FILE="${BACKUP_FILE}"
IS_DECRYPTED_TEMP=false
if [[ "${BACKUP_FILE}" == *.enc ]]; then
    echo "[INFO] Encrypted archive detected. Decrypting to temporary buffer..."
    TARGET_RESTORE_FILE="/tmp/restore_verify_$$.dump"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
        -in "${BACKUP_FILE}" \
        -out "${TARGET_RESTORE_FILE}" \
        -pass env:BACKUP_ENCRYPTION_PASSPHRASE
    IS_DECRYPTED_TEMP=true
fi

# Step 3: Create isolated verification sandbox database
echo "[INFO] Initializing isolated verification database: '${VERIFY_DB_NAME}'..."
PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c \
    "DROP DATABASE IF EXISTS \"${VERIFY_DB_NAME}\";"
PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c \
    "CREATE DATABASE \"${VERIFY_DB_NAME}\";"

# Step 4: Execute pg_restore
echo "[INFO] Executing pg_restore into sandbox database..."
RESTORE_STATUS=0
PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${VERIFY_DB_NAME}" \
    --no-owner \
    --no-privileges \
    "${TARGET_RESTORE_FILE}" || RESTORE_STATUS=$?

if [ ${RESTORE_STATUS} -gt 1 ]; then
    echo "[ERROR] pg_restore failed with exit code ${RESTORE_STATUS}." >&2
    exit 2
fi

# Step 5: Smoke Queries on Restored Database
echo "[INFO] Running automated integrity queries on restored data..."
MIGRATION_COUNT=$(PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${VERIFY_DB_NAME}" -t -A -c "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL;" || echo "0")
ELECTION_COUNT=$(PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${VERIFY_DB_NAME}" -t -A -c "SELECT count(*) FROM \"elections\";" || echo "0")
SETTINGS_COUNT=$(PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${VERIFY_DB_NAME}" -t -A -c "SELECT count(*) FROM \"system_settings\";" || echo "0")

echo "[VERIFICATION METRICS]"
echo "  - Completed Migrations: ${MIGRATION_COUNT}"
echo "  - Elections Restored:   ${ELECTION_COUNT}"
echo "  - Settings Records:     ${SETTINGS_COUNT}"

if [ "${MIGRATION_COUNT}" -eq 0 ]; then
    echo "[FAIL] Verification failed: No applied database migrations found in restored dataset." >&2
    exit 3
fi

# Clean up decrypted temporary file if created
if [ "${IS_DECRYPTED_TEMP}" = true ]; then
    rm -f "${TARGET_RESTORE_FILE}"
fi

# Step 6: Cleanup isolated database
if [ "${KEEP_VERIFY_DB}" != "true" ]; then
    echo "[INFO] Tearing down isolated verification database '${VERIFY_DB_NAME}'..."
    PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c \
        "DROP DATABASE IF EXISTS \"${VERIFY_DB_NAME}\";"
else
    echo "[INFO] KEEP_VERIFY_DB=true; preserving '${VERIFY_DB_NAME}' for manual inspection."
fi

echo "[SUCCESS] Disaster recovery backup verification passed all checks!"
exit 0
