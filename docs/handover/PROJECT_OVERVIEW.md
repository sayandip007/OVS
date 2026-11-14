# OVS Project Overview & Mission Statement

**System Name:** Online Voting System (OVS)  
**System Status:** Release Candidate (Phase 8.15 Certified)  
**Target Environment:** Academic, Educational, Research & Simulation Prototype  

---

## 1. System Purpose & Educational Mission

The **Online Voting System (OVS)** is an advanced educational simulation platform designed to model the complexity, constitutional geography, administrative rigor, and integrity requirements of Indian elections.

### Key Objectives
1. **Constitutional Geography Modeling:** Faithfully represent India's federal structure across 36 States/UTs, distinguishing bicameral Parliamentary Constituencies (PC) for Lok Sabha and Assembly Constituencies (AC) for State Legislative Assemblies.
2. **End-to-End Election Administration:** Implement realistic administrative workflows including election gazetting, constituency assignment, candidate nominations, multi-stage scrutiny, schedule milestone enforcement, and result publication.
3. **Multi-Role Administrative RBAC:** Model administrative hierarchies with strict jurisdiction isolation across 5 distinct roles:
   - `SUPER_ADMIN` (Chief Election Commissioner)
   - `NATIONAL_ADMIN` (Election Commission of India)
   - `STATE_ADMIN` (Chief Electoral Officers)
   - `ELECTION_OFFICER` (Returning Officers)
   - `READ_ONLY_AUDITOR` (Independent Compliance Monitors)
4. **Absolute Voter Anonymity & Secret Ballot:** Demonstrate an educational electronic voting system where voter participation is verified and recorded without the backend system ever knowing, storing, or transmitting the voter's candidate selection.
5. **Independent Synthetic Counting:** Model election tally reconciliation, round-by-round progression, tie detection, and statutory tie resolution completely decoupled from individual voter participation.

---

## 2. Non-Binding Educational Boundaries

> [!IMPORTANT]
> OVS is strictly an educational prototype and research platform.
> - **Zero Legal Authority:** OVS does not conduct legally binding public elections.
> - **Synthetic Identity:** Voter profiles, EPIC numbers, mobile numbers, and OTP verifications are local demo simulations. No actual Indian identity systems (such as UIDAI Aadhaar or ECI NVSP/VHA) are integrated.
> - **Synthetic Candidate Data:** Candidate profiles, party listings, and vote counts are fictional demonstration fixtures.
> - **Zero Official Turnout:** Recorded participation figures represent simulation test cycles, not genuine voter turnout.

---

## 3. Technology Stack Summary

- **Frontend:** React 19 SPA, Tailwind CSS v4, Lucide Icons, React Router v7.
- **Backend:** Node.js 22 LTS, Express 5, TypeScript 5.8, Zod schema validation.
- **ORM & Database:** Prisma ORM 5.22, PostgreSQL 16 with native triggers and advisory locks.
- **Security & Crypto:** scrypt PHC password hashing, constant-time verification, Helmet headers, CORS policies, CSRF tokens, HttpOnly SameSite=Strict cookies.
- **Observability:** Prometheus metrics (`/metrics`), Pino structured logging, health probes (`/health`, `/ready`, `/live`).
- **DevOps:** Docker multi-stage images, Docker Compose, WAL-G backup architecture, GitHub Actions CI.
