-- ==============================================================================
-- OVS PostgreSQL Disaster Recovery & Replication Configuration
-- ==============================================================================
-- Automatically loaded on container initialization in docker-entrypoint-initdb.d

-- Configure WAL for Point-In-Time Recovery (PITR) and physical backup
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_size = '2GB';
ALTER SYSTEM SET min_wal_size = '512MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET archive_mode = 'off'; -- Set to 'on' in managed cloud environments with archive_command

-- Connection limits and timeouts
ALTER SYSTEM SET statement_timeout = '30000'; -- 30s max query execution
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60000'; -- 60s idle in transaction
