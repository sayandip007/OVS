# Security Protections & Prototype Limitations (`SECURITY-LIMITATIONS.md`)

## 1. Educational Prototype Disclaimer

This Online Voting System (OVS) is a **client-side React educational prototype**. All data resides in the user's browser `localStorage`. It is designed to demonstrate user interface workflows, electoral data modelling, simultaneous ballot separation, and counting analytics. **It must never be used for real or legally binding elections.**

---

## 2. Implemented Frontend Security & Privacy Controls

### 2.1 Secret-Ballot Data Separation
- **Participation Records (`ovs_v3_0_participation`)** record only *that* a voter participated in a specific election and constituency (`voterId`, `electionId`, `constituencyId`, `referenceId`, `timestamp`).
- **Aggregate Tallies (`ovs_v3_0_votes`)** store only anonymous vote counters keyed by `electionId__constituencyId__candidateId`.
- **Audit Guarantee**: Neither the Voter Receipt, Voter History, Admin Voter Registry, Audit Logs, nor Dataset Exports contain any link between a `voterId` and a selected `candidateId`.

### 2.2 CSV Formula-Injection Defense (`countingService.js`)
- Exported CSV files (Constituency Results, Candidate Tallies, Party Standings, and Admin Audit Logs) pass every cell through `escapeCsvCell()`.
- Any cell value beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is prefixed with a single quote (`'`) and wrapped in escaped double quotes (`"..."`), neutralizing spreadsheet formula execution (DDE/CSV injection) in Microsoft Excel, LibreOffice Calc, and Google Sheets.

### 2.3 Input Sanitization & Safe Media Validation (`validation.js`)
- **Text Sanitization (`sanitizeTextInput`)**: Strips HTML angle brackets (`<`, `>`), `javascript:` / `data:text/html` URI schemes, and ASCII control characters before persisting admin or voter form inputs.
- **Image URL Verification (`isSafeImageUrl`)**: Allows only `https://`, `http://`, relative `/`, or safe `data:image/(png|jpeg|jpg|webp|gif|svg+xml)` URLs, blocking `javascript:` and `vbscript:` injection vectors.
- **File Upload Validation (`validateImageFile`)**: Restricts candidate/party symbol uploads to verified image MIME types (`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`) and enforces a strict **2 MB** maximum file size.

### 2.4 Resilient Storage & Error Boundary Recovery
- **Corrupted `localStorage` Recovery (`storageService.js`)**: Wraps all `JSON.parse` operations in `try/catch` blocks; malformed keys automatically fall back to clean canonical seed data without crashing the UI.
- **Global `ErrorBoundary` (`ErrorBoundary.jsx`)**: Catches unexpected React rendering exceptions, hides internal stack traces from end users, and provides one-click **Return to Homepage** and **Reset Demo Data & Reload** recovery actions.

---

## 3. Architectural Limitations of a Frontend-Only Prototype

In a real-world national election system, the following backend and cryptographic controls would be required (and are intentionally out of scope for this browser-only demonstration):

1. **No Hardware EVM / Air-Gapped Isolation**: Real Indian elections use standalone, non-networked Electronic Voting Machines (EVMs) with physical Voter Verifiable Paper Audit Trail (VVPAT) slips stored in sealed strongrooms.
2. **Client-Side Storage Mutability**: Because all state is stored in browser `localStorage`, a user with browser DevTools access can inspect or reset their local state.
3. **Simulated Authentication**: Voter EPIC OTP verification and ECI Admin login operate against local seed records rather than a hardware-backed Aadhaar/EPIC cryptographic identity provider or HSM.
4. **No Zero-Knowledge Proofs or Homomorphic Tallying**: Vote anonymity in this prototype is achieved via data-structure decoupling in memory/storage rather than cryptographic mix-nets or homomorphic encryption.
