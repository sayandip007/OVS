# OVS Frontend-to-Backend Migration Plan

## 1. Executive Migration Strategy

The Online Voting System (OVS) has a comprehensive, working React 19 frontend tested across 37 automated Node.js test suites and 12 real Chromium Playwright E2E browser suites.

To ensure **zero regressions** and complete operational safety during backend integration, we adopt an **Adapter Pattern with Dual-Mode Architecture**:
1. **Dual-Mode Operation**: The application will support both `LOCAL_DEMO` mode (using existing `localStorage` and seeded JS data) and `BACKEND_API` mode (connecting to `/api/v1/*` via Express and PostgreSQL).
2. **Runtime Mode Switch**: Controlled via environment variable `VITE_DATA_SOURCE_MODE=BACKEND_API | LOCAL_DEMO` with an in-app fallback toggle for development.
3. **Preserved Service Contracts**: Frontend services retain their method signatures. The implementation inside the service switches between calling local helper functions or executing asynchronous HTTP queries (`apiClient`).

---

## 2. Frontend-to-Backend Service Mapping Matrix

| Existing Frontend Module | Future Backend API Module | Migration Strategy & Interface Preservation |
| :--- | :--- | :--- |
| **`src/services/storageService.js`** | `/api/v1/admin/system` & HTTP Client | In `LOCAL_DEMO` mode, uses browser `localStorage`. In `BACKEND_API` mode, delegates state to remote PostgreSQL via REST requests. |
| **`src/services/electionService.js`** | `/api/v1/elections` & `/api/v1/demo-participation` | Preserves `createElectionRecord`, `updateElectionRecord`, and `recordSimulatedParticipation`. Under `BACKEND_API`, dispatches `POST /api/v1/demo-participation`. |
| **`src/services/candidateService.js`** | `/api/v1/candidates` & `/api/v1/parties` | Preserves candidate validation and filtering. Delegates candidate creation and scrutiny status updates to `/api/v1/admin/candidates`. |
| **`src/services/constituencyService.js`** | `/api/v1/geography` | Queries normalized states, districts, PCs, and ACs from `/api/v1/geography/*`. Preserves dual-constituency lookups. |
| **`src/services/countingService.js`** | `/api/v1/admin/counting-sessions` & `/api/v1/results` | Standings calculations remain in frontend for instantaneous chart responsiveness; round advancements and result publication transition to `/api/v1/admin/counting-sessions/*`. |
| **`src/services/dataIntegrityService.js`** | `/api/v1/admin/integrity-audit` | Retains client-side diagnostic suite while adding remote verification calling the backend 17-rule integrity audit endpoint. |
| **`src/services/adminPermissionService.js`** | `/api/v1/admin/*` & Middleware | Retains client-side UI permission checks (`canAdminAccessRoute`, `canAdminPerformAction`) for responsive navigation while backend middleware strictly enforces permissions on every request. |
| **`src/context/AuthContext.jsx`** | `/api/v1/auth/*` | Replaces in-memory credential checks with `POST /api/v1/auth/login` and `POST /api/v1/auth/otp/verify`, storing session via HttpOnly cookies. |
| **`src/context/ElectionContext.jsx`** | Master Domain API Client | Fetches initial elections, candidates, results, announcements, and audit logs via React query / TanStack Query hooks or structured `useEffect` fetches. |
| **`src/context/VoterContext.jsx`** | `/api/v1/voters/me/*` | Replaces local voter state with `/api/v1/voters/me`, providing live server-backed `eligibleElections` and participation summaries. |

---

## 3. Dual-Mode Adapter Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT CONTEXT PROVIDERS                         │
│         AuthContext  │  ElectionContext  │  VoterContext               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                       SERVICE ADAPTER INTERFACE                        │
│   e.g. recordSimulatedParticipation(voter, electionId, ...)            │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
    [VITE_DATA_SOURCE_MODE === 'LOCAL_DEMO']         │ [VITE_DATA_SOURCE_MODE === 'BACKEND_API']
                    │                                │
┌───────────────────▼─────────────┐    ┌─────────────▼───────────────────┐
│     LOCAL DEMO IMPLEMENTATION   │    │      API CLIENT IMPLEMENTATION   │
│  - Browser localStorage         │    │  - fetch / Axios to /api/v1     │
│  - In-memory mock OTPs          │    │  - HttpOnly Cookie sessions     │
│  - Instantaneous demo resets    │    │  - PostgreSQL persistent state  │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

### Example: Adapter Implementation in `electionService.js`

```javascript
// src/services/electionService.js (Future Phase 8.2 Migration)
import { isBackendModeEnabled, apiClient } from '../utils/apiClient';
import { recordLocalSimulatedParticipation } from './localElectionService';

export async function recordSimulatedParticipation(params) {
  if (!isBackendModeEnabled()) {
    // Preserve 100% of existing Phase 7.7 local logic
    return recordLocalSimulatedParticipation(params);
  }

  // Backend API Mode
  const response = await apiClient.post('/api/v1/demo-participation', {
    electionId: params.electionId,
  });

  return {
    ok: true,
    voter: response.data.voter,
    participatedAt: response.data.participatedAt,
    demoReference: response.data.demoReference,
    referenceId: response.data.referenceId,
    ballotCountingSeparation: 'STRICT_DECOUPLED',
  };
}
```

---

## 4. Phased Migration Schedule

### Phase 8.2 — API Client & Read-Only Domain Integration
- Introduce `apiClient` with base URL configuration and interceptors.
- Connect `geography`, `parties`, and `elections` read endpoints.
- Validate that the Public Portal renders from PostgreSQL data without any UI changes.

### Phase 8.3 — Authentication & Voter Portal Integration
- Connect `AuthContext` to `POST /api/v1/auth/login` and `/api/v1/auth/otp/verify`.
- Migrate `Register.jsx` to `POST /api/v1/auth/register`.
- Connect voter dashboard, profile, and notifications to `/api/v1/voters/me/*`.

### Phase 8.4 — Demo Ballot, Participation & Admin Scrutiny Integration
- Connect `BallotPage.jsx` and `DemoConfirmationModal.jsx` to `POST /api/v1/demo-participation`.
- Verify zero candidate-choice persistence across network requests (inspect DevTools network payload).
- Connect Admin Candidate Scrutiny to `PATCH /api/v1/admin/candidates/:id/approval`.

### Phase 8.5 — Counting Simulation, Results & Full E2E Verification
- Connect counting session round execution and result publication to `/api/v1/admin/counting-sessions/*`.
- Run full Playwright test suite against the backend-backed deployment.
- Verify 100% feature parity with zero regressions.
