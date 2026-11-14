# OVS Phase 8.6 — Candidate Profile Management

## 1. Data Model (`Candidate`)

Reuses `Candidate` in [`backend/prisma/schema.prisma`](..\..\backend\prisma\schema.prisma), extended in [`20261112000400_phase_8_6_candidates_parties_nominations/migration.sql`](..\..\backend\prisma\migrations\20261112000400_phase_8_6_candidates_parties_nominations\migration.sql):
- `id`, `partyId`, `displayName`, `fullName`, `age` (>= 25), `gender`, `education`, `profession`, `criminalCases`, `assetsDeclared`, `liabilitiesDeclared`, `photoUrl`, `bio`, `isActive`, `deactivatedAt`, `metadataSource`.
- No Aadhaar, EPIC, passport, or bank identifiers are stored.

## 2. Endpoints

- **Admin (`/api/v1/admin/candidates`)**: `GET /`, `GET /:candidateId`, `POST /`, `PATCH /:candidateId`, `POST /:candidateId/deactivate`.
- **Public (`/api/v1/candidates`)**: `GET /`, `GET /:candidateId` (active candidates only; only `APPROVED` nominations; omits `scrutinyNote` and internal fields).
