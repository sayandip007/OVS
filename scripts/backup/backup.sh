#!/usr/bin/env bash
# ==============================================================================
# OVS Automated Database Backup Script (POSIX Bash)
# ==============================================================================
# Performs consistent logical backup using pg_dump custom format (-Fc),
# calculates SHA-256 checksum, supports optional AES-256 encryption,
# and enforces backup retention limits.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ovs_db}"
DB_USER="${DB_USER:-ovs_admin}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_FILE="${BACKUP_DIR}/ovs_${DB_NAME}_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] [${TIMESTAMP}] Starting OVS database backup for database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}..."

# Execute pg_dump using PostgreSQL custom archive format (-Fc)
if command -v pg_dump >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -Fc \
        -v \
        -f "${BACKUP_FILE}"
else
    echo "[WARN] Local pg_dump not found. Attempting backup via Docker container 'ovs-prod-postgres'..."
    docker exec -e PGPASSWORD="${PGPASSWORD:-ovs_secret_dev}" ovs-prod-postgres \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${BACKUP_FILE}"
fi

# Verify artifact creation
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "[ERROR] Backup failed: Artifact ${BACKUP_FILE} is missing or empty." >&2
    exit 1
fi

BACKUP_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || wc -c < "${BACKUP_FILE}")
echo "[INFO] Backup completed successfully. Size: ${BACKUP_SIZE} bytes."

# Generate SHA-256 Checksum
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
else
    openssl dgst -sha256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
fi

echo "[INFO] Checksum generated at: ${CHECKSUM_FILE}"

# Optional AES-256 Symmetric Encryption
if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
    echo "[INFO] Encrypting backup with OpenSSL AES-256-CBC..."
    ENCRYPTED_FILE="${BACKUP_FILE}.enc"
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "${BACKUP_FILE}" \
        -out "${ENCRYPTED_FILE}" \
        -pass env:BACKUP_ENCRYPTION_PASSPHRASE
    
    # Checksum for encrypted artifact
    sha256sum "${ENCRYPTED_FILE}" > "${ENCRYPTED_FILE}.sha256"
    rm -f "${BACKUP_FILE}" "${CHECKSUM_FILE}"
    echo "[INFO] Backup encrypted: ${ENCRYPTED_FILE}"
fi

# Retention policy enforcement: Prune backups older than RETENTION_DAYS
echo "[INFO] Enforcing retention policy: deleting backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f \( -name "ovs_*.dump*" -o -name "ovs_*.sha256" \) -mtime "+${RETENTION_DAYS}" -exec rm -f {} +

echo "[SUCCESS] Backup lifecycle operation concluded successfully."
