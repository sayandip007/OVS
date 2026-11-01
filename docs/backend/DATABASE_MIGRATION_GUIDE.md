# OVS Database Migration & Custom SQL Integrity Guide (`docs/backend/DATABASE_MIGRATION_GUIDE.md`)

## 1. Authoritative Schema Location

In Phase 8.2, the Prisma schema has been promoted to:
- **Authoritative Schema**: `backend/prisma/schema.prisma`
- **Architecture Mirror**: `docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma` (kept byte-for-byte identical and verified by automated architecture consistency tests).

The schema defines **25 models** and **17 PostgreSQL enums** with 100% explicit `@map("snake_case")` column mappings and `@@map("snake_case")` table mappings.

---

## 2. Two-Stage Prisma Migration History

Because PostgreSQL triggers, partial unique indexes (`WHERE ... IS NOT NULL`), and multi-column CHECK constraints cannot be expressed natively in Prisma's declarative DSL, OVS uses a deterministic two-step Prisma migration history under `backend/prisma/migrations/`:

1. **`20261101000000_init_base_schema/migration.sql`**
   - Generated directly from `backend/prisma/schema.prisma` (`prisma migrate diff --from-empty --to-schema-datamodel backend/prisma/schema.prisma --script`).
   - Creates all **17 PostgreSQL enum types**, **25 tables**, primary keys, unique indexes, performance indexes, and base foreign keys.
2. **`20261101000100_custom_database_integrity/migration.sql`**
   - Applies the full custom SQL integrity layer from `docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql` immediately after the base tables and enums exist:
     - Composite unique constraints and composite foreign keys enforcing geographic hierarchy (`District -> State`, `AssemblyConstituency -> District + State`, `AssemblyConstituency -> ParliamentaryConstituency + State`, `VoterProfile -> AC + PC + District + State`).
     - Historical nomination-party composite foreign keys (`fk_tally_nomination_candidate_party`).
     - 6 partial unique indexes (`uq_election_constituency_pc`, `uq_election_constituency_ac`, `uq_nomination_candidate_election_pc`, `uq_nomination_candidate_election_ac`, `uq_counting_session_pc`, `uq_counting_session_ac`).
     - 11 table-level CHECK constraints.
     - 16 PL/pgSQL trigger functions and 16 triggers enforcing Section 33(7) nomination limits, election-constituency mapping compatibility, counting round progression, vote reconciliation, tie-resolution proof (`v_total_tally_count > 0`, `v_max_votes > 0`, `v_top_tied_count >= 2`), and publication review gates (`TIED -> RESULT_READY_FOR_REVIEW -> PUBLISHED`).

---

## 3. Applying Migrations & Seeding

```bash
# Validate schema
npm --prefix backend run prisma:validate

# Generate Prisma Client
npm --prefix backend run prisma:generate

# Apply all migrations in order (Base DDL -> Custom SQL Integrity Layer)
npm --prefix backend run prisma:migrate:deploy

# Seed idempotent DEMO_SAMPLE dataset
npm --prefix backend run prisma:seed
```

---

## 4. Important PostgreSQL Connection URI Note (`psql` vs Prisma)

- **Prisma ORM** supports the `?schema=public` query parameter in `DATABASE_URL` (e.g., `postgresql://ovs_admin:ovs_secret_dev@localhost:5432/ovs_db?schema=public`).
- **`psql` (libpq)** rejects `?schema=public` as an unrecognized URI connection parameter (`psql: error: invalid URI query parameter: "schema"`).
- When invoking `psql` directly with `$DATABASE_URL`, strip the query string using `${DATABASE_URL%\?*}`:
  ```bash
  psql "${DATABASE_URL%\?*}" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql
  ```
