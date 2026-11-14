# OVS Voter User Guide

**Portal:** Public Voter Portal (`/voter/*`)  
**Purpose:** Simulated Voter Journey & Educational Ballot Experience  

---

## 1. Voter Journey Overview

The OVS voter portal models the complete lifecycle of a democratic voter:

```text
[Public Discovery] 
        │
        ▼
[Voter Registration / Login] 
        │
        ▼
[Profile & Constituency Verification]
        │
        ▼
[Eligible Elections Presentation]
        │
        ▼
[Volatile Ballot Interaction]
        │
        ▼
[Zero-Knowledge Participation Confirmation]
        │
        ▼
[Non-Identifying Participation History]
```

---

## 2. Step-by-Step Instructions

### Step 1: Registration & Eligibility
- **Age Requirement:** Must be at least 18 years old on the simulation qualifying date. Underage registrations are rejected.
- **EPIC Number:** Standard Indian EPIC format (3 uppercase letters followed by 7 digits, e.g., `WBK1234567` or `DEMO-EPIC-8801`).
- **Geographic Mapping:** Select State -> District -> Parliamentary Constituency (PC) -> Assembly Constituency (AC).

### Step 2: Simulated OTP Login
- Enter registered EPIC and 10-digit mobile number.
- Click **Request OTP**. In development/demo mode, the 6-digit OTP is shown on screen.
- Verify OTP within 5 minutes. Three incorrect attempts trigger temporary lockout.

### Step 3: Reviewing Eligible Elections
- **Lok Sabha Elections:** Automatically visible to all registered voters nationwide regardless of state.
- **State Assembly Elections:** Strictly filtered so voters only see elections for their registered home state.

### Step 4: Casting a Simulated Vote (Zero-Knowledge Privacy)
- Review candidate cards, bios, party symbols, and NOTA option.
- Select your preferred candidate. Your choice exists solely in volatile browser component memory.
- Click **Cast Demo Vote**.
- A modal confirms that your participation status will be recorded, but your candidate selection is discarded.
- Click **Confirm**. The backend receives an empty request body `{}` and records your participation.

### Step 5: Duplicate Prevention & Participation History
- Once recorded, attempting to vote in the same election displays *"Already Participated"* and disables the ballot.
- Simultaneous elections (e.g., Lok Sabha + Assembly) remain independently accessible.
- Your **Participation History** displays the timestamp and election ID, with strictly zero indication of which candidate you selected.
