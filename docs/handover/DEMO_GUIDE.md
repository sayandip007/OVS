# OVS Demonstration Guide & Evaluator Runbook

**Audience:** Technical Evaluators, Academic Reviewers, Academic Juries  
**Prerequisites:** Running application on `http://localhost:3000` (in `LOCAL_DEMO` or `BACKEND_API` mode)  

---

## 1. Step-by-Step Educational Demonstration Script

### Scene 1: Public Portal & Educational Framing
1. Open your browser and navigate to `http://localhost:3000/`.
2. Notice the tricolour top banner and explicit educational prototype disclaimer:
   *"Educational Election-System Prototype · Local Demonstration Data Only"*.
3. Test the Accessibility Display Controls in the header:
   - Click **A-**, **A**, and **A+** to observe fluid rem-based typography scaling.
   - Click the contrast icon to toggle high-contrast WCAG 2.1 AA mode.
4. Click **Elections** in the navbar to review currently scheduled demo elections (`LS-2029`, `WB-ASSEMBLY-2029`).

---

### Scene 2: Synthetic Voter Journey & Secret Ballot
1. Navigate to `/register` or `/voter/login`.
2. Enter demo voter credentials:
   - **EPIC Number:** `DEMO-EPIC-8801`
   - **Mobile Number:** `9800008801`
3. Click **Request OTP**. In development mode, the simulated OTP challenge is displayed on screen or logged to console (`582910`).
4. Enter the 6-digit OTP and click **Verify & Sign In**.
5. Inspect the **Voter Profile**:
   - Confirm assigned state: *West Bengal (`WB`)*.
   - Parliamentary Constituency: *Kolkata South (`WB-PC-KOLKATA-SOUTH`)*.
   - Assembly Constituency: *Bhabanipur (`WB-AC-BHABANIPUR`)*.
6. Open **Eligible Elections**:
   - Notice that both Lok Sabha (`LS-2029`) and West Bengal Assembly (`WB-ASSEMBLY-2029`) are eligible.
   - Maharashtra and Delhi Assembly elections are filtered out automatically.
7. Click **Open Ballot** for `LS-2029`:
   - Inspect the approved candidates, party symbols, and NOTA.
   - Select a candidate (or NOTA).
   - Click **Cast Demo Vote**.
   - Review the confirmation modal reiterating that candidate choice will NOT be recorded.
   - Click **Confirm Participation**.
8. Observe the success screen with non-identifying participation reference.
9. Attempt to vote again in `LS-2029` — verify the system displays *"Already Participated"* and blocks duplicate participation.
10. Open `WB-ASSEMBLY-2029` — verify that simultaneous participation in the Assembly election remains available.

---

### Scene 3: Multi-Role Administrator Console & RBAC Scoping
1. Navigate to `http://localhost:3000/eci/login`.
2. **Test 1: SUPER_ADMIN (`ECI-SUPER-DEMO` / `DemoAdmin@2029!`)**
   - Access **System Settings** and **Feature Flags**.
   - View national audit logs.
   - Provision a new administrator.
3. **Test 2: STATE_ADMIN (`ECI-WB-DEMO` / `DemoAdmin@2029!`)**
   - Access West Bengal election and nomination records.
   - Attempt to navigate to Maharashtra or Delhi constituencies — observe permission denied (HTTP 403).
4. **Test 3: READ_ONLY_AUDITOR (`ECI-AUDITOR-DEMO` / `DemoAdmin@2029!`)**
   - Review election status, counting logs, and audit logs.
   - Export CSV analytics (observe sanitized RFC 4180 output).
   - Notice that all mutation buttons (Create, Update, Delete) are disabled or hidden.

---

### Scene 4: Independent Counting & Tie Resolution
1. As `SUPER_ADMIN`, navigate to `/eci/results`.
2. Review published session `RESULT-LS-2029-WB-PC-KRISHNANAGAR`:
   - Inspect round progression (Rounds 1 through 5).
   - Verify candidate vote share, victory margin, and lead margin charts.
3. Inspect session `RESULT-LS-2029-DL-PC-NEW-DELHI`:
   - Note the genuine synthetic tie (4,800 votes each for AAP and BJP).
   - Review the statutory `LOTTERY_DRAW` tie-resolution audit entry resolving the tie and promoting the session to `RESULT_READY_FOR_REVIEW`.
