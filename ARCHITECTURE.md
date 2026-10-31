# OVS System Architecture (`ARCHITECTURE.md`)

## 1. High-Level Architectural Overview

The Online Voting System (OVS) follows a modular, layered React 19 + Vite architecture using domain-specific services, strict relational invariants, and versioned browser `localStorage` persistence (`ovs_v3_0_*`).

```
src/
├── components/
│   ├── common/          # ErrorBoundary, Navbar (with A11y controls), Footer, Modal, DisclaimerBanner
│   └── election/        # Reusable ballot, candidate, and result cards
├── context/
│   ├── AuthContext.jsx      # Session state, role guards,EPIC/Admin login
│   ├── ElectionContext.jsx  # Master state store, CRUD actions, voting & counting orchestration
│   └── ToastContext.jsx     # Non-blocking UI feedback notifications
├── data/
│   └── indiaElectionSeed.js # Canonical 36-State/UT seed data, PCs, ACs, Parties, Elections, Candidates, Voters
├── layouts/
│   ├── PublicLayout.jsx     # Public portal shell with skip-link & disclaimer
│   ├── VoterLayout.jsx      # Authenticated voter shell
│   └── AdminLayout.jsx      # ECI Administration sidebar shell
├── pages/
│   ├── public/              # Home, Elections, Candidates, Results, About, Login, Register
│   ├── voter/               # Dashboard, Simultaneous Vote Hub, Ballot Unit, Receipt, History, Profile
│   └── admin/               # Dashboard, States, Constituencies, Parties, Candidates, Voters, Elections, Results, AuditLogs, Settings
├── services/
│   ├── electionService.js      # Pure domain logic for ballot eligibility, simultaneous filtering, and validation
│   ├── countingService.js      # Deterministic counting engine, round simulation, margin/winner resolver, CSV exporter
│   ├── dataIntegrityService.js # 17-Rule relational & provenance audit engine
│   └── storageService.js       # Safe JSON serialization, schema migration, and corruption recovery
└── utils/
    ├── constants.js            # Canonical enums (ELECTION_TYPES, CONSTITUENCY_TYPES, RESULT_STATUS, etc.)
    └── validation.js           # Input sanitization, EPIC regex, safe image URL & upload validators
```

---

## 2. Electoral Geography & Strict PC / AC Separation

India's electoral geography is represented using four strictly linked layers:

1. **States & Union Territories (`states`)**: All 28 States (`type: 'STATE'`) and 8 Union Territories (`type: 'UNION_TERRITORY'`), annotated with `hasLegislativeAssembly` (`true` for 28 States + NCT of Delhi, Puducherry, and Jammu & Kashmir).
2. **Districts (`districts`)**: Linked via `stateId`.
3. **Parliamentary Constituencies (`parliamentaryConstituencies`)**:
   - `constituencyType: 'PC'`
   - Used **exclusively** by `LOK_SABHA` elections.
4. **Assembly Constituencies (`assemblyConstituencies`)**:
   - `constituencyType: 'AC'`
   - Linked to a parent `stateId`, `districtId`, and `pcId`.
   - Used **exclusively** by `STATE_ASSEMBLY` elections.

### Enforced Domain Invariant
A Lok Sabha candidate or ballot **never** attaches to an Assembly Constituency (`AC`), and a State Assembly candidate or ballot **never** attaches to a Parliamentary Constituency (`PC`). This invariant is enforced at:
- Seed generation (`indiaElectionSeed.js`)
- Admin nomination validation (`ElectionContext.jsx`)
- Voter ballot construction (`electionService.js`)
- Counting & result calculation (`countingService.js`)
- Live 17-Rule Integrity Audit (`dataIntegrityService.js`)

---

## 3. Simultaneous Election Architecture

Each voter record contains two distinct constituency pointers:
- `pcId`: Parliamentary Constituency ID (e.g., `pc-mh-mumbai-north`)
- `acId`: Assembly Constituency ID (e.g., `ac-mh-borivali`)

When aLok Sabha election and a State Assembly election are simultaneously `ACTIVE` in the voter's state:
1. `buildSimultaneousVoterDashboard(voter, ...)` resolves both elections independently.
2. Each election generates its own isolated Ballot (`LOK_SABHA` filtered by `voter.pcId`, `STATE_ASSEMBLY` filtered by `voter.acId`).
3. Casting a vote in the Lok Sabha election writes a participation record scoped strictly to `(voter.id, lokSabhaElection.id, voter.pcId)`.
4. The voter's State Assembly ballot `(voter.id, assemblyElection.id, voter.acId)` remains `ELIGIBLE` and unlocked until separately cast.

---

## 4. Secret-Ballot Privacy Separation

To preserve ballot secrecy in browser storage, OVS separates **participation proof** from **vote tallies**:

- **`participationRecords` (`ovs_v3_0_participation`)**:
  - Stores `{ id, referenceId, voterId, electionId, electionType, constituencyId, constituencyType, stateId, timestamp }`.
  - **Prohibited fields**: `candidateId`, `partyId`, `ballotChoice`, `selectedCandidate`.
- **`votes` (`ovs_v3_0_votes`)**:
  - Stores anonymous aggregate counters keyed by `${electionId}__${constituencyId}__${candidateId || 'NOTA'}`.
  - Incremented atomically when a ballot is cast; contains no voter identifier or timestamp linkable to a voter.

---

## 5. Counting & Results Engine (`countingService.js`)

- **Vote Sources**: Combines actual cast demo votes (`votes` map) with deterministic or admin-configured counting rounds (`EVM` + `Postal` votes) and explicit **NOTA** tallies.
- **Winner & Margin Resolution**:
  - Sorts candidates + NOTA by total votes descending.
  - Computes `percentage = (candidateVotes / totalValidVotes) * 100`.
  - Detects exact mathematical ties (`isTie: true`, `margin: 0`) among top contenders and blocks automatic winner declaration until resolved.
- **Publication Lifecycle**:
  - `NOT_STARTED` → `IN_PROGRESS` (live trends visible) → `COMPLETED` (all rounds tabulated) → `PUBLISHED` (officially certified on public portal).
