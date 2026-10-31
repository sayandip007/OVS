# Security Review, Privacy Architecture & Frontend Prototype Limitations

## 1. Executive Summary

The **Online Voting System (OVS)** is an **educational frontend architecture prototype** built with React 19, Vite, and Tailwind CSS. It is designed to demonstrate Indian electoral geography (28 States and 8 Union Territories), dual-constituency voter mapping (Parliamentary + Assembly), simultaneous election workflows, role-based administration UI patterns, and round-by-round counting analytics.

**CRITICAL NOTICE**: This application is **NOT** a production voting system, is **NOT** affiliated with or endorsed by the Election Commission of India (ECI), and must **NEVER** be used to conduct real-world elections.

---

## 2. Enforced Frontend Security & Privacy Controls

### 2.1 Strict Ballot Secrecy, Simulated Timestamp Normalization & Zero Candidate-Choice Persistence
- **Volatile Selection Only**: In `src/pages/voter/BallotPage.jsx` and `src/components/ballot/BallotReview.jsx`, the voter's selected candidate or `NOTA` option is held exclusively in temporary React component state (`useState`).
- **Non-Revealing Participation Record**: When the voter clicks **Complete demo participation** in `src/components/ballot/DemoConfirmationModal.jsx`, `recordSimulatedParticipation` (`src/services/electionService.js`) records **only**:
  - `status: 'VOTED'`
  - `participated: true`
  - `participatedAt: '2029-04-20T10:30:00.000Z'` (normalized to the centralized demo clock via `getDemoReferenceIso` in `src/utils/constants.js` so participation metadata never leaks fine-grained host wall-clock timing by default)
  - `demoReference: 'DEMO-LS-000001'` or `'DEMO-ASM-000001'`
  - `referenceId: 'DEMO-REF-<ELECTION>-<VOTER>'`
- **Separation of `participatedAt` and `recordedAt`**: Any actual system recording timestamp (`recordedAt`) is kept distinct from `participatedAt` and is omitted from persisted voter records (`voter.elections[electionId]`) unless `includeSystemTimestamp: true` is explicitly passed for diagnostic testing.
- **Automated Privacy Audit (Rule 12 & Browser E2E Verification)**:
  - `auditElectionDataIntegrity` (`src/services/dataIntegrityService.js`) continuously scans all voter participation records to ensure forbidden keys (`candidateId`, `selectedCandidateId`, `selectedCandidateIdOrNota`, `partyId`, `ballotChoice`, `selectedOptionId`) are never present.
  - Real Chromium browser E2E test `tests/e2e/candidate-choice-privacy.spec.js` inspects `localStorage` (`ovs_v3_0_voters`, `ovs_v3_0_tallies`, `ovs_v3_0_results`, `ovs_v3_0_audit_logs`), `sessionStorage`, and the rendered DOM receipt after ballot completion to verify zero candidate-choice persistence.

### 2.2 Complete Decoupling of Voter Ballots and Counting Simulation
- Confirming a demo ballot in the Voter Portal **never** increments candidate vote tallies or counting session records (`recordSimulatedParticipation` leaves `tallies` untouched and returns `ballotCountingSeparation: 'STRICT_DECOUPLED'`).
- Constituency counting sessions in `src/services/countingService.js` operate exclusively on deterministic demonstration datasets (`INITIAL_RESULTS` in `src/data/results.js` and FNV-1a hash-seeded round increments).
- This architectural separation guarantees that neither an administrator nor an external observer can deduce a voter's ballot selection by inspecting counting totals before and after a voter participates.

### 2.3 Input Sanitization, Safe URLs & CSV Injection Prevention
- **XSS / HTML Tag Stripping**: `sanitizeTextInput` (`src/utils/validation.js`) strips `<script>`, event handlers, and angle-bracket tags from user-supplied text fields.
- **Image URL & Upload Validation**: `isSafeImageUrl` and `validateImageFile` (`src/utils/validation.js`) reject `javascript:` and `vbscript:` URIs and enforce allowed image MIME types (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`) and file size limits.
- **CSV Formula Injection Protection**: `escapeCsvCell` (`src/services/countingService.js`) prefixes cells starting with `=`, `+`, `-`, or `@` with a single quote (`'`) before exporting constituency, party, or state CSV reports.
- **Audit Log Redaction**: `createSanitizedAuditLogEntry` (`src/services/adminPermissionService.js`) strips demo OTP codes (`123456`, `654321`) and never logs ballot selections.

---

## 3. Inherent Limitations of a Frontend-Only Architecture

Because this project is intentionally restricted to a **100% client-side browser environment** without a backend server, database, or hardware security module:

1. **Client-Side Storage (`localStorage`) Is User-Inspectable**:
   - All application state (`ovs_v3_0_*` keys in `src/utils/constants.js`) resides in browser `localStorage`. Any user with browser DevTools access on the same device can inspect, modify, or clear `localStorage`.
2. **Simulated Authentication & OTPs**:
   - Voter login (`/voter/login`) and ECI Officer login (`/eci/login`) use deterministic client-side demo OTPs (`123456` / `654321`) defined in `src/utils/constants.js` (`DEMO_OTP_CODES`). No SMS gateway, Aadhaar e-KYC, EPIC cryptographic verification, or server-side session token validation is performed.
3. **Client-Side RBAC & Route Guards**:
   - Role permissions in `src/services/adminPermissionService.js` (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`, `READ_ONLY_AUDITOR`) and route guards in `src/routes/AppRoutes.jsx` enforce UI and state boundaries within the React app, but cannot replace server-enforced authorization in a production system.
4. **No Cryptographic End-to-End Verifiability (E2E-V) or VVPAT Hardware**:
   - Real public elections in India rely on air-gapped Electronic Voting Machines (EVMs) with Voter Verifiable Paper Audit Trails (VVPAT) managed by the Election Commission of India. This prototype does not implement homomorphic encryption, mixnets, zero-knowledge proofs, or physical paper audit trails.
