# OVS Administrator User Guide

**Portal:** Election Commission Portal (`/eci/*`)  
**Authentication:** Officer Code + Password + Session Token  

---

## 1. Role Capabilities Matrix

| Administrative Role | National Scope | State Scope | Constituency Scope | Mutating Rights | Audit Log Access |
|---|---|---|---|---|---|
| **SUPER_ADMIN** | Full Platform | All States | All PCs/ACs | Full Create/Update/Delete | Full System-Wide |
| **NATIONAL_ADMIN** | Nationwide | All States | All PCs/ACs | Elections, Candidates, Nominations | Read-Only |
| **STATE_ADMIN** | None | Assigned State Only | ACs in State | Scrutiny, AC Schedules | State-Scoped Only |
| **ELECTION_OFFICER** | None | Assigned State Only | Assigned PC/AC | Tally Entry, Local Scrutiny | Officer Scope Only |
| **READ_ONLY_AUDITOR** | Full Visibility | All States | All PCs/ACs | **STRICTLY ZERO MUTATIONS** | Full System-Wide Read |

---

## 2. Key Administrative Workflows

### 1. Creating and Scheduling an Election
1. Navigate to **Elections -> Create Election**.
2. Select Election Type: `LOK_SABHA` or `STATE_ASSEMBLY`.
3. For `STATE_ASSEMBLY`, select the target State (e.g., `WB`).
4. Configure the 8 schedule milestones:
   - `NOMINATION_OPEN`
   - `NOMINATION_DEADLINE`
   - `NOMINATION_SCRUTINY`
   - `WITHDRAWAL_DEADLINE`
   - `CAMPAIGN_START`
   - `CAMPAIGN_END`
   - `POLLING_START`
   - `POLLING_END`
   - `COUNTING_START`
   - `RESULT_PUBLICATION`
5. Submit configuration for review (`SUBMITTED_FOR_REVIEW`) and approve as `SUPER_ADMIN`.

### 2. Candidate Nomination Scrutiny
1. Navigate to **Candidates & Nominations**.
2. Select submitted nominations in status `SUBMITTED`.
3. Click **Scrutinize**:
   - Verify party endorsement or independent candidate affidavit.
   - Enter scrutiny notes.
   - Click **Approve** or **Reject** with formal justification.
4. Approved nominations appear on the final ballot after withdrawal deadline passes.

### 3. Tally Entry & Result Declaration
1. Navigate to **Results Management**.
2. For an ongoing election, select constituency counting session.
3. Advance counting rounds: enter synthetic votes per candidate, NOTA, and rejected ballots.
4. If a tie is detected, the session enters `TIED` status.
5. Authorized admin resolves the tie using statutory method (`LOTTERY_DRAW`, `RECOUNT`, or `RETURNING_OFFICER_DECISION`).
6. Advance through `COUNTING_COMPLETED` -> `RESULT_READY_FOR_REVIEW` -> `PUBLISHED`.
