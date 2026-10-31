# OVS — Phase 7.7 Mandatory Initial Audit Report

## 1. Current Package Manager & Runtime Environment

- **Node.js Version**: `v22.23.4`
- **npm Version**: `10.9.9`
- **Bun Version Present in Container**: `1.4.4`
- **Current Package Manager State**: Mixed / ambiguous.
  - `package.json` does not declare a `"packageManager"` or `"engines"` field.
  - `bun.lock` (`35,732` bytes, lockfileVersion 2) exists in the repository root.
  - `package-lock.json` is **missing** from the repository root, even though `README.md` and `PHASE_7_6_FINAL_REPORT.md` referenced `package-lock.json`.
  - `playwright.config.js` invokes `npm run dev -- --host 127.0.0.1 --port 3000`.
  - Documentation (`README.md`, `TESTING.md`) references `npm` commands (`npm run dev`, `npm test`, `npm run build`), while `npm ci` currently fails because `package-lock.json` does not exist.

---

## 2. Current Dependency Versions (`package.json`)

### `dependencies`
| Package | Declared Version Range | Installed / Locked Version |
| :--- | :--- | :--- |
| `@tailwindcss/vite` | `^4.3.3` | `4.3.3` |
| `@vitejs/plugin-react` | `^6.1.1` | `6.1.2` |
| `lucide-react` | `^0.546.0` | `0.546.0` |
| `motion` | `^12.23.24` | `12.43.0` |
| `react` | `^19.0.1` | `19.3.1` |
| `react-dom` | `^19.0.1` | `19.3.1` |
| `react-router-dom` | `^7.18.5` | `7.18.5` |
| `vite` | `^8.3.0` | `8.3.5` |

### `devDependencies`
| Package | Declared Version Range | Installed / Locked Version |
| :--- | :--- | :--- |
| `@playwright/test` | `^1.64.1` | `1.64.1` |
| `@types/node` | `^22.14.0` | `22.20.5` |
| `@types/react` | `^19.3.0` | `19.3.0` |
| `@types/react-dom` | `^19.3.0` | `19.3.0` |
| `autoprefixer` | `^10.4.21` | `10.6.2` |
| `tailwindcss` | `^4.3.3` | `4.3.3` |
| `typescript` | `^7.0.2` | `7.0.2` |

> **Audit Note on `typescript` and `eslint`**:
> - `typescript` is currently `^7.0.2` (`@typescript/native-preview` / TypeScript 7.0 native Go binary in this environment).
> - `eslint` is **not** currently installed in `devDependencies`, and no `eslint.config.js` exists in the repository root.

---

## 3. Lockfile & `.gitignore` State

- **`bun.lock`**: Present in root (`304` lines).
- **`package-lock.json`**: Missing in root. Running `npm ci` fails immediately with `npm error The npm ci command can only install with an existing package-lock.json`.
- **`.gitignore`**: Missing in root. `node_modules/`, `dist/`, `playwright-report/`, and `test-results/` are currently untracked by a `.gitignore` file.

---

## 4. Build, Typecheck & Lint Configuration

### Build Configuration (`vite.config.ts`)
- Uses `@vitejs/plugin-react` and `@tailwindcss/vite` on `vite@8.3.5`.
- Path alias `'@'` resolves to `path.resolve(import.meta.dirname, '.')`.
- Missing `"preview": "vite preview --port=3000 --host=0.0.0.0"` script in `package.json`.

### Typecheck Configuration (`tsconfig.json`)
- `"include": ["src"]`, `"allowJs": true`, `"jsx": "react-jsx"`, `"noEmit": true`, `"types": ["vite/client", "node"]`.
- Does not include `vite.config.ts` or set `checkJs: false` explicitly; predominantly validates module syntax, JSX transform, and TypeScript config files while keeping the React codebase in JavaScript (`.js`/`.jsx`).

### Lint Configuration (`package.json`)
- Currently both `"typecheck"` and `"lint"` are set to `"tsc --noEmit"`.
- These are not distinct operations: `"typecheck"` runs TypeScript compiler validation, whereas `"lint"` should run ESLint static analysis (`eslint .`) across the JavaScript/JSX codebase using a dedicated `eslint.config.js`.

---

## 5. Playwright Configuration (`playwright.config.js`)

- `testDir: './tests/e2e'` with 12 spec files (`public-portal.spec.js`, `voter-registration.spec.js`, `voter-authentication.spec.js`, `lok-sabha-ballot.spec.js`, `assembly-ballot.spec.js`, `simultaneous-elections.spec.js`, `candidate-choice-privacy.spec.js`, `admin-election-management.spec.js`, `candidate-management.spec.js`, `counting-results.spec.js`, `data-integrity.spec.js`, `recovery-reset.spec.js`).
- `baseURL`: `process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'`.
- `trace`: `'on-first-retry'`, `screenshot`: `'only-on-failure'`.
- Detects pre-installed headless shell `/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell` when present and falls back to standard Playwright-managed Chromium otherwise.
- `webServer.command`: `'npm run dev -- --host 127.0.0.1 --port 3000'`.

---

## 6. Hardcoded Date Comparison in `src/services/electionService.js`

- In `src/services/electionService.js` (lines 213–217):
  ```js
  const customElectionClockDate =
    election?.simulationClockDate &&
    election.simulationClockDate !== '2029-04-20'
      ? `${election.simulationClockDate}T10:30:00.000Z`
      : null;
  ```
- **Root Cause**: `INITIAL_ELECTIONS` in `src/data/elections.js` initialized `simulationClockDate: DEMO_CLOCK_CONFIG.referenceDate` at module load time, snapshotting `'2029-04-20'` onto every default election record. To work around that snapshot when `setDemoClockConfig` modified the global clock in tests, `electionService.js` compared `election.simulationClockDate !== '2029-04-20'`.
- **Required Fix**:
  1. Seeded elections in `src/data/elections.js` that do not have a custom per-election clock override should leave `simulationClockDate: null` (so they dynamically inherit the centralized `DEMO_CLOCK_CONFIG` via `getDemoReferenceDate()` / `getDemoReferenceIso()`).
  2. In `src/services/electionService.js`, remove the hardcoded `'2029-04-20'` comparison completely. Resolve the participation timestamp by checking `simulatedTimestamp`, `election?.simulationTimestamp`, and `election?.simulationClockDate` using `isValidIsoDateString` / `isValidIsoTimestamp` and `getDemoReferenceIso` from `src/utils/constants.js`, falling back to `DEMO_CLOCK_CONFIG.referenceTimestamp` whenever no valid override is configured.

---

## 7. Planned Corrections (Phase 7.7 Execution Plan)

1. **Standardize on `npm` as Canonical Package Manager**:
   - Add `"packageManager": "npm@10.9.9"` and `"engines": { "node": ">=22.0.0", "npm": ">=10.0.0" }` to `package.json`.
   - Install `eslint`, `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh` as devDependencies via `npm`.
   - Generate a valid `package-lock.json`, verify `npm ci` succeeds cleanly, and remove the obsolete `bun.lock`.
   - Create `.gitignore` excluding `node_modules/`, `dist/`, `playwright-report/`, `test-results/`, and environment/log artifacts.
2. **Eliminate Hardcoded Date Comparison in `src/services/electionService.js`**:
   - Harden `isValidIsoTimestamp` in `src/utils/constants.js` to reject non-ISO strings.
   - Update `src/data/elections.js` so seeded elections inherit the centralized clock unless explicitly overridden (`simulationClockDate: null`).
   - Update `recordSimulatedParticipation` in `src/services/electionService.js` to remove `'2029-04-20'` and resolve `participatedAt` strictly via `src/utils/constants.js` clock helpers.
   - Add comprehensive unit tests in `tests/electionArchitecture.test.mjs` for default demo clock, valid election-specific `simulationTimestamp`, election-specific timestamp with a different date, missing election-specific timestamp, invalid election-specific timestamp, `participatedAt` generation, and `recordedAt` separation.
3. **Separate `lint` (ESLint) and `typecheck` (`tsc --noEmit`)**:
   - Create `eslint.config.js` supporting React 19 + Vite JS/JSX (`src/**/*.{js,jsx}`, `tests/**/*.{js,mjs}`, `playwright.config.js`).
   - Update `package.json` scripts:
     - `"lint": "eslint ."`
     - `"typecheck": "tsc --noEmit"`
     - `"test": "node --import ./tests/loader.mjs --test tests/electionArchitecture.test.mjs"`
     - `"test:unit": "node --import ./tests/loader.mjs --test tests/electionArchitecture.test.mjs"`
     - `"test:e2e": "playwright test"`
     - `"build": "vite build"`
     - `"preview": "vite preview --port=3000 --host=0.0.0.0"`
4. **CI/CD Workflow & Full Verification**:
   - Create `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install --with-deps chromium`, and `npm run test:e2e`.
   - Execute the full verification sequence (`npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install chromium`, `npm run test:e2e`) and record exact outputs in `PHASE_7_7_FINAL_REPORT.md`.
