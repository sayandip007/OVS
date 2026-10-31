# Testing & Quality Assurance Guide (`TESTING.md`)

## 1. Automated Test Suite

The OVS project uses Node's built-in test runner (`node --test`) executing `/tests/electionArchitecture.test.mjs`. It validates domain services, seed datasets, simultaneous voting flows, secret-ballot privacy, counting math, CSV security, and data integrity rules without requiring a browser binary.

### Run All Tests

```bash
npm test
```

---

## 2. Automated Test Coverage Breakdown

| Phase / Suite | Focus Area | Key Assertions |
| :--- | :--- | :--- |
| **Phase 2 (`2.1–2.4`)** | Geography & Seed Integrity | All 28 States + 8 UTs (`36` total), valid `pcId`/`acId` linkages, national & state political parties. |
| **Phase 3 & 4 (`3.1–4.5`)** | Voter Eligibility & Simultaneous Ballots | Dual-ballot resolution (`PC` + `AC`), mandatory `NOTA` presence, independent ballot locking, duplicate vote rejection, suspended/unverified voter rejection. |
| **Phase 5 (`5.1–5.5`)** | ECI Admin Governance | Election status transitions, candidate nomination validation, symbol conflict detection, audit log generation. |
| **Phase 6 (`6.1–6.7`)** | Counting, Analytics & Exports | Candidate/NOTA tallying, percentage & margin accuracy, tie detection, Lok Sabha national seat-share, Vidhan Sabha state summary, CSV export formatting. |
| **Phase 7 (`7.1–7.5`)** | QA, Security & 17-Rule Integrity Audit | 17-Rule `auditElectionDataIntegrity` verification, Simultaneous Scenarios `A–L`, numerical edge cases (0 votes, 1 candidate, NOTA leads, 2/3-way ties, large tallies), CSV formula injection defense, input sanitization, safe image validation, and documentation existence. |

---

## 3. Live 17-Rule Election Data Integrity Audit

Implemented in `src/services/dataIntegrityService.js` and visible live under **Admin Portal → System Settings (`/admin/settings`)**, the integrity engine continuously checks:

1. **R01**: Exactly 28 States and 8 Union Territories (36 jurisdictions) with unique IDs and codes.
2. **R02**: Every District links to a valid State/UT.
3. **R03**: Every Parliamentary Constituency (`PC`) has `constituencyType === 'PC'` and a valid `stateId`.
4. **R04**: Every Assembly Constituency (`AC`) has `constituencyType === 'AC'`, valid `stateId`, and valid parent `pcId`.
5. **R05**: Every Election has a valid `type` (`LOK_SABHA` or `STATE_ASSEMBLY`) and valid `status`.
6. **R06**: Every Political Party has a unique ID, abbreviation, and classification.
7. **R07**: Every Candidate links to an existing Election, Party, and Constituency.
8. **R08**: Strict PC/AC Separation — `LOK_SABHA` candidates link only to `PC`; `STATE_ASSEMBLY` candidates link only to `AC`.
9. **R09**: No duplicate approved party nominations in the same `(electionId, constituencyId)` (excluding `IND`).
10. **R10**: Every Voter has a valid 10-character EPIC number (`^[A-Z]{3}[0-9]{7}$`), valid `stateId`, `pcId`, and `acId`.
11. **R11**: Voter's `pcId` and `acId` belong to the voter's assigned `stateId`.
12. **R12**: Every Participation Record links to a valid Voter, Election, and matching Constituency type.
13. **R13**: Uniqueness — At most one Participation Record per `(voterId, electionId)`.
14. **R14**: Secret Ballot Privacy — Zero Participation Records contain `candidateId`, `partyId`, `choice`, or `ballotChoice`.
15. **R15**: Vote tally keys (`electionId__constituencyId__candidateId`) reference valid elections and constituencies with non-negative integer counts.
16. **R16**: Counting Result records match election/constituency types and have valid round arrays and status values.
17. **R17**: Every simulated seed record carries explicit `provenance: 'SIMULATED_DEMO'` metadata.

---

## 4. Manual Verification Walkthroughs

### Journey 1: Simultaneous Voter Experience
1. Open `/login` and click **Demo Voter: Rajesh Sharma (Maharashtra — Simultaneous)**.
2. Observe both **Mumbai North (PC)** and **Borivali (AC)** on `/voter/dashboard`.
3. Navigate to `/voter/vote`, cast a ballot in the **Lok Sabha** election, and verify the VVPAT preview and Participation Receipt.
4. Return to `/voter/vote`: confirm the **Lok Sabha** card shows **Ballot Cast & Locked**, while the **Maharashtra Vidhan Sabha** card remains **Ready to Vote**.
5. Cast the State Assembly ballot and verify both receipts appear in `/voter/history` without revealing candidate selections.

### Journey 2: ECI Admin Counting & Results Publication
1. Log in as **ECI Admin** (`admin@eci.gov.in` / `admin123`) and open `/admin/results`.
2. Select **18th Lok Sabha General Election** → **Mumbai North (PC)**.
3. Click **Simulate Next Round** to advance counting rounds, then click **Complete Counting** and **Publish Official Result**.
4. Visit `/results` (Public Portal) and confirm the published badge, winner/leading breakdown, and **Export CSV** download.
