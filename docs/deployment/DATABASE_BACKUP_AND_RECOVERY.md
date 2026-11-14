# OVS Database Backup, Point-In-Time Recovery & Verification

## 1. Strategy Overview

The Online Voting System (OVS) PostgreSQL database stores critical audit trails, election configuration, candidate nominations, and independent synthetic counting tallies. A robust backup and recovery strategy ensures data resilience and rapid disaster recovery.

### Objectives
- **Recovery Point Objective (RPO):** < 15 minutes (with WAL archiving) or < 1 hour (logical snapshots).
- **Recovery Time Objective (RTO):** < 30 minutes to full service restoration.
- **Verification Guarantee:** 100% of backups must undergo automated non-destructive restore verification into an isolated sandbox database before being marked valid.

---

## 2. Backup Implementation (`scripts/backup/backup.sh` & `.ps1`)

Backups are executed using PostgreSQL's custom archive format (`pg_dump -Fc`):
- Compressed, platform-independent binary format.
- Allows parallel restores (`pg_restore -j`) and selective table restoration.
- Consistent single-transaction snapshot across all tables.

### Key Features
1. **Timestamped Naming:** `ovs_<DB_NAME>_<YYYYMMDD_HHMMSSZ>.dump`.
2. **SHA-256 Checksumming:** Generates a companion `<BACKUP_FILE>.sha256` containing the cryptographic hash.
3. **Optional AES-256-CBC Encryption:** Supports encryption with PBKDF2 key derivation when `BACKUP_ENCRYPTION_PASSPHRASE` is provided.
4. **Automated Retention Enforcement:** Prunes archives older than `RETENTION_DAYS` (default: 14 days).

### Executing a Backup
```bash
# POSIX Bash
export DB_NAME="ovs_production"
export DB_USER="ovs_admin"
export PGPASSWORD="your_secure_password"
./scripts/backup/backup.sh

# PowerShell (Windows)
.\scripts\backup\backup.ps1 -DbName "ovs_production" -DbUser "ovs_admin"
```

---

## 3. Non-Destructive Restore Verification (`scripts/backup/restore-verify.sh` & `.ps1`)

> [!CAUTION]
> Routine backup verification must **NEVER** restore into the production database. The verification script includes a hardcoded fail-closed invariant that aborts immediately if the target database name equals the production database.

### Verification Workflow
```
[Backup Archive + Checksum]
           |
           v
1. SHA-256 Hash Verification (Aborts on mismatch)
           |
           v
2. Decrypt if Encrypted (.enc)
           |
           v
3. Create Isolated Sandbox DB: "ovs_restore_verification_sandbox"
           |
           v
4. Run pg_restore into Sandbox
           |
           v
5. Execute Automated Integrity Smoke Queries:
   - Check _prisma_migrations (must be > 0)
   - Verify elections table integrity
   - Verify system_settings records
           |
           v
6. Teardown & Drop Sandbox Database
```

### Executing Verification
```bash
# Verify the latest dump
./scripts/backup/restore-verify.sh ./backups/ovs_ovs_production_20261114_090000Z.dump
```
