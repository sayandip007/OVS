# India-Wide Online Voting System (OVS) — Educational Prototype

> **EDUCATIONAL PROTOTYPE DISCLAIMER**
> This application is a **frontend-only educational and architectural prototype** designed to demonstrate Indian multi-tier electoral governance, simultaneous election ballot separation, secret-ballot participation tracking, and multi-round vote counting analytics. It is **not** affiliated with, endorsed by, or connected to the Election Commission of India (ECI) or any State Election Commission, and **cannot** be used to conduct legally binding elections.

---

## 1. Project Overview

The **Online Voting System (OVS)** is a scalable React and Vite frontend application modelling India's complete electoral hierarchy across all **28 States and 8 Union Territories (36 jurisdictions)**. It supports:

- **Lok Sabha General Elections** (`LOK_SABHA`) mapped solely to Parliamentary Constituencies (`PC`).
- **State Legislative Assembly Elections** (`STATE_ASSEMBLY` / Vidhan Sabha) mapped solely to Assembly Constituencies (`AC`).
- **Simultaneous Elections (One Nation, One Poll simulation)** where an eligible voter holds both a Parliamentary Constituency (`pcId`) and an Assembly Constituency (`acId`) and receives two independent, strictly separated electronic ballots (`EBU-1` for Lok Sabha and `EBU-2` for Vidhan Sabha).
- **Privacy-Preserving Vote Recording** where participation records (`voterId + electionId + constituencyId`) are completely decoupled from anonymous aggregate candidate tallies (`votes`).
- **Multi-Round Counting & Results Analytics** supporting EVM + Postal vote aggregation, round-by-round progression, tie detection, NOTA accounting, seat-share and vote-share dashboards, and formula-safe CSV exports.

---

## 2. Key Features by Portal

### Public Portal
- **Landing & Civic Education Hub**: Live election status overview, simultaneous election guide, and quick role switching.
- **Candidate & Constituency Explorer**: Filterable directory across all 36 States/UTs, Parliamentary Constituencies, Assembly Constituencies, and Political Parties.
- **Public Election Results Hub (`/results`)**:
  - National Lok Sabha Tally & Majority Threshold Tracker (`272 / 543`).
  - State Assembly Result Explorer across active states.
  - Constituency-level detailed scorecards, round-by-round progression tables, and CSV downloads.
  - Side-by-side Simultaneous Election Result Comparison (Lok Sabha PC vs. Vidhan Sabha AC).

### Voter Portal (`/voter/*`)
- **Voter Dashboard**: Dual-constituency mapping badge (`PC` + `AC`), active elections feed, and independent ballot readiness status.
- **Simultaneous Voting Hub (`/voter/vote`)**: Independent ballot launch cards for Lok Sabha (`PC`) and State Assembly (`AC`) with real-time completion locks.
- **Electronic Ballot Unit (`/voter/ballot/:electionId`)**:
  - Authentic EVM/VVPAT-inspired dark-slate interface with candidate serial numbers, party symbols, affidavits, and mandatory **NOTA (None of the Above)**.
  - Explicit two-step confirmation modal and simulated VVPAT slip verification preview before final cast.
- **Participation Receipts (`/voter/receipt`, `/voter/history`)**: Verifiable participation reference IDs and timestamps with **zero exposure** of the candidate or party chosen.

### ECI Administration Portal (`/admin/*`)
- **Command Center Dashboard**: Live turnout KPIs, active election status breakdown, and quick governance controls.
- **Geography & Constituency Masters**: Manage States/UTs, Districts, Parliamentary Constituencies (`PC`), and Assembly Constituencies (`AC`).
- **Political Parties & Candidate Nominations**: Nomination scrutiny (`APPROVED`, `PENDING`, `REJECTED`, `WITHDRAWN`), symbol allocation, and uniqueness validation.
- **Electoral Roll Management**: Searchable voter registry, EPIC verification (`APPROVED`, `PENDING`, `SUSPENDED`), and dual PC/AC assignment.
- **Counting & Results Management (`/admin/results`)**:
  - Initialize counting from cast ballots, simulate multi-round EVM + Postal counting, or manually edit round figures.
  - Official Status Workflow: `NOT_STARTED` → `IN_PROGRESS` → `COMPLETED` → `PUBLISHED` (with reopen/unpublish audit safeguards).
- **Audit Logs & Data Integrity (`/admin/audit`, `/admin/settings`)**:
  - Live **17-Rule Election Data Integrity & Provenance Audit** engine.
  - Full JSON dataset export/import and formula-safe CSV exports.

---

## 3. Demo Credentials

You can switch accounts instantly via the **Quick Demo Switcher** on the Login page (`/login`):

| Role | Identifier / EPIC / Email | Password / Info | Jurisdiction |
| :--- | :--- | :--- | :--- |
| **Voter (Maharashtra)** | `ABC1234567` | Any (EPIC OTP Demo) | Mumbai North (`PC`) & Borivali (`AC`) — Simultaneous Active |
| **Voter (Uttar Pradesh)** | `UPV9823411` | Any (EPIC OTP Demo) | Varanasi (`PC`) & Varanasi Cantt (`AC`) — Simultaneous Active |
| **Voter (NCT of Delhi)** | `DLV4410923` | Any (EPIC OTP Demo) | New Delhi (`PC`) & New Delhi (`AC`) |
| **National ECI Admin** | `admin@eci.gov.in` | `admin123` | Full All-India ECI Portal Access |

---

## 4. Setup & Commands

```bash
# Install dependencies
npm install

# Start development server (Port 3000)
npm run dev

# Run automated architectural, security, and E2E test suite
npm test

# Production build check
npm run build

# Lint codebase
npm run lint
```

---

## 5. Documentation Index

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Election data model, PC/AC separation, simultaneous ballot architecture, and counting state machine.
- [`TESTING.md`](./TESTING.md) — Automated test suite guide, 17-Rule Data Integrity Audit, and manual verification scenarios.
- [`SECURITY-LIMITATIONS.md`](./SECURITY-LIMITATIONS.md) — Secret-ballot privacy model, frontend security protections, and prototype limitations.
