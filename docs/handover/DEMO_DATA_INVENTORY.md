# OVS Phase 8.15 – Synthetic Demo Dataset Inventory

**System:** Online Voting System (OVS)  
**Classification:** Purely Synthetic Educational Dataset (`DEMO_SAMPLE`)  
**Seed Files:** `backend/prisma/seed.ts` & `backend/prisma/seed-demo.ts`  
**Execution Command:** `npx tsx backend/prisma/seed-demo.ts`  

---

## 1. Geographical & Jurisdictional Hierarchy

| State / UT | Code | Capital | Total LS Seats | Total AC Seats | Districts Sampled |
|---|---|---|---|---|---|
| **West Bengal** | `WB` | Kolkata | 42 | 294 | Nadia (`NADIA`), Kolkata (`WB-DIST-KOLKATA`) |
| **Maharashtra** | `MH` | Mumbai | 48 | 288 | Mumbai Suburban (`MH-DIST-MUMBAI-SUBURBAN`) |
| **NCT of Delhi** | `DL` | New Delhi | 7 | 70 | New Delhi (`DL-DIST-NEW-DELHI`) |

### Parliamentary Constituencies (PC)
1. `WB-PC-KRISHNANAGAR` (West Bengal, Nadia District, General)
2. `WB-PC-KOLKATA-SOUTH` (West Bengal, Kolkata District, General)
3. `WB-PC-KOLKATA-NORTH` (West Bengal, Kolkata District, General)
4. `MH-PC-MUMBAI-NORTH-CENTRAL` (Maharashtra, Mumbai Suburban, General)
5. `DL-PC-NEW-DELHI` (NCT of Delhi, New Delhi District, General)

### Assembly Constituencies (AC)
1. `WB-AC-KRISHNANAGAR-UTTAR` (West Bengal, Nadia District, General)
2. `WB-AC-BHABANIPUR` (West Bengal, Kolkata District, General)
3. `WB-AC-RASHBEHARI` (West Bengal, Kolkata District, General)
4. `MH-AC-BANDRA-WEST` (Maharashtra, Mumbai Suburban, General)
5. `DL-AC-NEW-DELHI` (NCT of Delhi, New Delhi District, General)

---

## 2. Political Parties & Synthetic Candidates

### Political Parties
- `PARTY-AITC`: All India Trinamool Congress (State, Symbol: Twin Flowers)
- `PARTY-BJP`: Bharatiya Janata Party (National, Symbol: Lotus)
- `PARTY-INC`: Indian National Congress (National, Symbol: Hand)
- `PARTY-AAP`: Aam Aadmi Party (National, Symbol: Broom)
- `PARTY-CPI-M`: Communist Party of India (Marxist) (National, Symbol: Hammer, Sickle & Star)

### Candidates & Nomination Status
| Candidate ID | Name | Affiliation | Election | Target Constituency | Nomination Status |
|---|---|---|---|---|---|
| `CAND-LS29-WB-KRN-1` | Mahua Mitra (DEMO) | AITC | `LS-2029` | `WB-PC-KRISHNANAGAR` | APPROVED (Winner in Demo) |
| `CAND-LS29-WB-KRN-2` | Kalyan Chaubey (DEMO) | BJP | `LS-2029` | `WB-PC-KRISHNANAGAR` | APPROVED (Runner-Up) |
| `CAND-LS29-WB-KRN-3` | Somnath Paul (DEMO) | INC | `LS-2029` | `WB-PC-KRISHNANAGAR` | APPROVED |
| `CAND-LS29-WB-KRN-4` | Bikash Halder (DEMO) | Independent | `LS-2029` | `WB-PC-KRISHNANAGAR` | APPROVED |
| `CAND-LS29-MH-MNC-1` | Priya Dutt (DEMO) | BJP | `LS-2029` | `MH-PC-MUMBAI-NORTH-CENTRAL` | APPROVED |
| `CAND-LS29-DL-ND-1` | Arvind Kejriwal (DEMO) | AAP | `LS-2029` | `DL-PC-NEW-DELHI` | APPROVED (Tied 4800 votes) |
| `CAND-LS29-DL-ND-2` | Bansuri Swaraj (DEMO) | BJP | `LS-2029` | `DL-PC-NEW-DELHI` | APPROVED (Tied 4800 votes) |
| `CAND-WBA29-KRNU-1` | Mukul Roy (DEMO) | AITC | `WB-ASSEMBLY-2029` | `WB-AC-KRISHNANAGAR-UTTAR` | APPROVED |
| `CAND-WBA29-KRNU-2` | Ashim Saha (DEMO) | BJP | `WB-ASSEMBLY-2029` | `WB-AC-KRISHNANAGAR-UTTAR` | APPROVED |
| `CAND-WBA29-KRNU-3` | Subhas Mondal (DEMO) | Independent | `WB-ASSEMBLY-2029` | `WB-AC-KRISHNANAGAR-UTTAR` | APPROVED |
| `CAND-MH29-BW-1` | Baba Siddique (DEMO) | INC | `MH-ASSEMBLY-2029` | `MH-AC-BANDRA-WEST` | SUBMITTED |
| `CAND-DL29-ND-1` | Somnath Bharti (DEMO) | AAP | `DL-ASSEMBLY-2029` | `DL-AC-NEW-DELHI` | DRAFT |

---

## 3. Administrator Accounts & Credentials (Local Demo Only)

> [!WARNING]
> These credentials are local demo fixtures with deterministic scrypt hashes. Never deploy to production.

Default Demo Password: `DemoAdmin@2029!`

| Officer Code | Email | Role | Jurisdiction Scope |
|---|---|---|---|
| `ECI-SUPER-DEMO` | `superadmin.demo@ovs-demo.invalid` | `SUPER_ADMIN` | Nationwide (Full platform & admin provision) |
| `ECI-NAT-DEMO` | `nationaladmin.demo@ovs-demo.invalid` | `NATIONAL_ADMIN` | Nationwide (Election admin, no settings rollback) |
| `ECI-WB-DEMO` | `stateadmin.wb.demo@ovs-demo.invalid` | `STATE_ADMIN` | West Bengal (`WB`) only |
| `ECI-MH-DEMO` | `stateadmin.mh.demo@ovs-demo.invalid` | `STATE_ADMIN` | Maharashtra (`MH`) only |
| `ECI-EO-WB-DEMO` | `ro.krishnanagar.demo@ovs-demo.invalid` | `ELECTION_OFFICER` | `LS-2029` & `WB-PC-KRISHNANAGAR` only |
| `ECI-AUDITOR-DEMO` | `auditor.demo@ovs-demo.invalid` | `READ_ONLY_AUDITOR` | Nationwide Read-Only & Audit Export (Zero mutations) |

---

## 4. Synthetic Demo Voters (Strictly Non-Identifying)

| EPIC Number | Full Name | State | District | Parliamentary Constituency | Assembly Constituency |
|---|---|---|---|---|---|
| `DEMO-EPIC-8801` | Aarav Chatterjee | WB | Kolkata | `WB-PC-KOLKATA-SOUTH` | `WB-AC-BHABANIPUR` |
| `DEMO-EPIC-8802` | Meera Sen | WB | Kolkata | `WB-PC-KOLKATA-NORTH` | `WB-AC-RASHBEHARI` |
| `DEMO-EPIC-8803` | Rohan Deshmukh | MH | Mumbai Sub. | `MH-PC-MUMBAI-NORTH-CENTRAL` | `MH-AC-BANDRA-WEST` |
| `DEMO-EPIC-8804` | Priya Sharma | DL | New Delhi | `DL-PC-NEW-DELHI` | `DL-AC-NEW-DELHI` |

---

## 5. Synthetic Counting & Tie Resolution Scenarios

1. **Published Scenario (`RESULT-LS-2029-WB-PC-KRISHNANAGAR`):**
   - 5 Counting Rounds, 15,000 total counted votes.
   - Winner: `CAND-LS29-WB-KRN-1` (AITC, 6,500 votes, 43.33%).
   - Status: `PUBLISHED`.
2. **Review-Ready Scenario (`RESULT-WB-ASSEMBLY-2029-WB-AC-KRISHNANAGAR-UTTAR`):**
   - 3 Counting Rounds, 10,000 total counted votes.
   - Winner: `CAND-WBA29-KRNU-1` (AITC, 5,000 votes, 50.0%).
   - Status: `RESULT_READY_FOR_REVIEW`.
3. **Genuine Tie Resolution Scenario (`RESULT-LS-2029-DL-PC-NEW-DELHI`):**
   - Candidate `CAND-LS29-DL-ND-1` (AAP) and `CAND-LS29-DL-ND-2` (BJP) each received exactly 4,800 votes.
   - Status transitioned from `TIED` to `RESULT_READY_FOR_REVIEW` via statutory `LOTTERY_DRAW` tie-break witnessed by observers.
