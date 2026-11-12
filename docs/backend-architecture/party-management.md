# OVS Phase 8.6 — Political Party Management

## 1. Data Model (`PoliticalParty`)

Reuses `PoliticalParty`, `PartyType` (`NATIONAL`, `STATE`, `INDEPENDENT`), and `PartyStatus` (`ACTIVE`, `INACTIVE`, `ARCHIVED`), extended with `description` and case-insensitive unique abbreviation index `uq_political_parties_abbreviation_upper`.

## 2. Endpoints

- **Admin (`/api/v1/admin/parties`)**: `GET /`, `GET /:partyId`, `POST /` (`STATE_ADMIN` limited to `STATE` parties), `PATCH /:partyId` (`STATE_ADMIN` cannot modify `NATIONAL` parties).
- **Public (`/api/v1/parties`)**: `GET /`, `GET /:partyId`.
- Parties with historical nominations are never physically deleted (`onDelete: Restrict`).
