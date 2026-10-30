# Frontend UI & Functionality Implementation Plan (`plan.md`)
## Online Voting Portal for India — UI, UX & Client-Side Architecture Guide for AI Agents

> **STRICT RULES FOR ALL AI AGENTS**:
> 1. **Frontend-Only Scope (No Backend Yet)**: Focus strictly on **UI, UX, and client-side functionality** using React (`.jsx`) and Tailwind CSS. Do **not** create backend servers, databases, or external API calls at this stage. All state and persistence must work seamlessly in the browser via React state/context + `localStorage` / `sessionStorage`.
> 2. **Keep All 18 Assets Untouched**: Do **NOT** delete, rename, or replace any image file in `/` or `/src/assets.js` (`eci-logo.png`, `g20-logo.png`, `75-years-logo.png`, `default-avatar.png`, `candidate1.jpg`–`candidate6.jpg`, `logo1.png`–`logo6.png`, `nota.jpg`, `nota.png`).
> 3. **Preserve Original Colors & Layouts**: Keep the existing color scheme (`#002d72` navbar/footer, `#004d99` headings and primary buttons, `#0359b4` role buttons, `#f4c542` nav hover, and the `linear-gradient(to bottom, #f9bb7c, #FFFFFF, #92f589)` tricolor background) and card layouts intact.
> 4. **JSX Only**: All React components must use `.jsx` extensions. Never use `window.alert()` or `window.confirm()` (use inline messages or React modals so nothing breaks inside sandboxed iframes).

---

## 1. Current File & Asset Map

### 1.1 Locked Static Assets (`/src/assets.js`)
- **Header Logos**: `eciLogo` (`eci-logo.png`), `g20Logo` (`g20-logo.png`), `years75Logo` (`75-years-logo.png`)
- **Default Voter Avatar**: `defaultAvatar` (`default-avatar.png`)
- **Default Candidates & Party Symbols**:
  1. `candidate1` + `logo1` — Narendra Modi (`BJP`)
  2. `candidate2` + `logo2` — Rahul Gandhi (`INC`)
  3. `candidate3` + `logo3` — Chandrababu Naidu (`TDP`)
  4. `candidate4` + `logo4` — Sitaram Yechury (`CPIM`)
  5. `candidate5` + `logo5` — Mamata Banerjee (`AITC`)
  6. `candidate6` + `logo6` — Nitish Kumar (`JDU`)
  7. `notaImg` + `notaLogo` — None of the Above (`NOTA`)

### 1.2 Current JSX Component Tree
- `/src/main.jsx` — Application entry point
- `/src/App.jsx` — Top-level page router & state orchestrator
- `/src/components/Navbar.jsx` — Sticky `#002d72` navbar with ECI, G20, and 75-Years logos
- `/src/components/Footer.jsx` — `#002d72` footer with policy links
- `/src/pages/Home.jsx` — Voter / ECI Officer role selection screen
- `/src/pages/About.jsx` — Portal mission & link to Feedback
- `/src/pages/Login.jsx` — Voter login + 6-digit OTP verification + 30s countdown timer
- `/src/pages/Register.jsx` — Voter registration form
- `/src/pages/EciLogin.jsx` — ECI Officer login + 6-digit OTP verification
- `/src/pages/EciRegister.jsx` — ECI Officer candidate registration form
- `/src/pages/Dashboard.jsx` — Voter profile card, avatar upload, and Vote action
- `/src/pages/Vote.jsx` — Electronic Voting Machine (EVM) ballot interface with 7-minute timer & red LED indicator
- `/src/pages/Results.jsx` — Election results table
- `/src/pages/Feedback.jsx` — User feedback form

---

## 2. Step-by-Step UI & Functionality Roadmap for AI Agents

To make the frontend behave like a complete, realistic, India-ready Election Commission of India (ECI) portal at scale—while keeping the exact visual design—AI agents should implement the following 5 UI & functionality phases in order.

---

### Phase 1: Centralized Client-Side State & Persistent Store (`/src/context/VotingContext.jsx`)
**Problem Solved**: Currently, refreshing the browser resets registered voters, newly added candidates, and vote counts, and `hasVoted` is stored as a single global flag rather than per-voter.

**Tasks for AI Agent**:
1. Create `/src/context/VotingContext.jsx` backed by `localStorage` keys:
   - `eci_voters`: Array of registered voters. Pre-seeded with default demo voter:
     ```js
     {
       aadhaarNumber: '999988881234',
       voterNumber: '1234',
       epicNumber: 'ECI1234567',
       firstName: 'John',
       lastName: 'Doe',
       email: 'john.doe@example.com',
       phoneNumber: '9876543210',
       state: 'National Capital Territory of Delhi',
       constituency: 'New Delhi',
       profileImage: null,
       hasVoted: false,
       vvpatReceipt: null
     }
     ```
   - `eci_candidates`: Array of candidates pre-seeded with the 7 original candidates (`candidate1`–`candidate6` + `notaImg` and `logo1`–`logo6` + `notaLogo`) and their initial vote counts (`240, 99, 16, 4, 29, 12, 0`).
   - `eci_current_voter`: Currently logged-in voter object (persisted in `sessionStorage`).
   - `eci_officer_authenticated`: Boolean in `sessionStorage` tracking ECI Officer session.
   - `eci_election_config`: `{ resultsDeclared: true, resultReleaseTime: '2024-08-16T10:00:00' }`.
   - `eci_feedbacks`: Array of submitted feedback items.
2. Provide helper actions to all pages:
   - `registerVoter(voterData)`
   - `loginVoter(userId, phone)`
   - `logoutUser()`
   - `updateVoterProfileImage(voterNumber, dataUrl)`
   - `castVote(voterNumber, candidateId)`
   - `registerCandidate(candidateData)`
   - `submitFeedback(feedbackData)`

---

### Phase 2: India-Specific Voter Registration & OTP UX (`Register.jsx` & `Login.jsx`)
**Goal**: Support authentic Indian electoral formats (12-digit Aadhaar, 10-character EPIC Voter ID, Indian States/Constituencies) while maintaining backward compatibility with the demo login (`1234` / `9876543210`).

**Tasks for AI Agent**:
1. **Enhance `/src/pages/Register.jsx`**:
   - Keep the existing `.form-container` card styling and fields (`Aadhaar Number`, `Voter Number`, `First Name`, `Last Name`, `Email`, `Phone Number`).
   - Add an **Indian State / UT** dropdown (`28 States + 8 Union Territories`) and **Lok Sabha Constituency** selector (or input) styled identically to the existing inputs (`w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px]`).
   - Validate:
     - **Aadhaar Number**: 12 digits (`/^\d{12}$/`) or 4-digit demo ID. Display a masked preview (`XXXX-XXXX-1234`) for privacy compliance.
     - **Voter Number (EPIC)**: Accept standard Indian EPIC format (`^[A-Z]{3}\d{7}$`, e.g., `ABC1234567`) OR 4-digit numeric ID (`^\d{4}$`) for quick testing.
     - **Phone Number**: 10-digit Indian mobile number (`^[6-9]\d{9}$` or `9876543210`).
     - Prevent duplicate registration if Aadhaar or Voter Number already exists in `eci_voters`.
2. **Enhance `/src/pages/Login.jsx` & `/src/pages/EciLogin.jsx`**:
   - Accept login via **Voter Number (EPIC)** or **Aadhaar Number** + **Phone Number**.
   - **Simulated SMS OTP Banner**: When `Send OTP` succeeds, display a non-intrusive simulated SMS notification banner at the top of the card (e.g., `"ECI SMS: Your verification OTP is 123456"` or a dynamically generated 6-digit OTP, and `"654321"` when `Resend OTP` is clicked) so the user can see the active OTP directly in the UI.
   - **Full 6-Digit Paste Support**: Allow pasting a 6-digit code directly into the first OTP input box (`#otp1`) to auto-fill `#otp1` through `#otp6`.

---

### Phase 3: Dynamic Voter Dashboard & EPIC Card View (`Dashboard.jsx`)
**Goal**: Make `/src/pages/Dashboard.jsx` reflect the actual logged-in voter's profile and live voting status instead of hardcoded static text.

**Tasks for AI Agent**:
1. Keep the exact card layout, circular profile image with `+` hover overlay (`#profileImage`, `#uploadProfileImage`), and `#voteButton`.
2. Dynamically display the logged-in voter's:
   - **Name**: `{currentVoter.firstName} {currentVoter.lastName}` (defaults to `John Doe` if viewing directly)
   - **Voter ID (EPIC)**: `{currentVoter.voterNumber}`
   - **Email**: `{currentVoter.email || 'Not Provided'}`
   - **Constituency**: `{currentVoter.constituency}, {currentVoter.state}` (if available)
   - **Voting Status**:
     - If `currentVoter.hasVoted === false`: Show `Not Voted` and enable the `Vote` button (`#voteButton`).
     - If `currentVoter.hasVoted === true`: Show `Voted ✓` (in `#2d8d31` green), display their **Digital VVPAT Receipt Code** (`#voteMessage`), and disable/update the `Vote` button to `"Vote Cast"`.
3. Persist any uploaded profile photo (`FileReader` DataURL) into `eci_voters` for the logged-in voter so it remains saved when navigating between pages.
4. Add a clean `Logout` button alongside `Vote` so a user can log out and log in as a second voter or as an ECI Officer to test multi-voter flows in the same browser session.

---

### Phase 4: Authentic Indian EVM & Digital VVPAT Experience (`Vote.jsx`)
**Goal**: Upgrade the Electronic Voting Machine (EVM) interface in `/src/pages/Vote.jsx` with realistic Indian EVM behavior, dynamic candidates, and a Digital VVPAT confirmation slip.

**Tasks for AI Agent**:
1. **Dynamic Candidate Rendering with NOTA Always Last**:
   - Load the candidate list from `VotingContext` (`eci_candidates`).
   - Ensure any new candidate added via `/src/pages/EciRegister.jsx` renders in the EVM list with its uploaded candidate photo and party logo, while **Slot #N `None of the Above (NOTA)`** (`nota.jpg` + `nota.png`) is always kept as the final row.
2. **EVM Red Indicator Light & Web Audio Beep (Optional/Safe)**:
   - When clicking `VOTE` on a candidate row:
     - Turn that row's `.indicator` (`#indicator{id}`) background to `red` (`bg-red-600`).
     - Optionally trigger a short Web Audio API oscillator beep (standard EVM confirmation tone) wrapped in a `try/catch`.
3. **Inline Digital VVPAT Confirmation Modal (No `window.alert`/`window.confirm`)**:
   - When clicking `Submit Vote`:
     - Show an inline confirmation modal / card overlay displaying the **Digital VVPAT (Voter Verifiable Paper Audit Trail) Slip**:
       - Candidate Serial Number
       - Candidate Name & Party Name
       - Party Symbol Image
       - Unique Receipt Hash (e.g., `VVPAT-IND-2026-XXXXXX`)
     - Once confirmed:
       - Mark `hasVoted = true` for the current voter in `VotingContext`.
       - Increment the selected candidate's vote count by `1` in `eci_candidates`.
       - Display `"You have successfully voted!"` in `#voteMessage` and disable the `VOTE` buttons.
4. **Per-Session 7-Minute Timer**:
   - Start a fresh 7-minute timer (`07:00`) when a new unvoted voter enters `/src/pages/Vote.jsx`, and automatically return to `/src/pages/Dashboard.jsx` if the timer reaches `00:00`.

---

### Phase 5: ECI Officer Candidate Management, Live Results & High-Scale UI (`EciRegister.jsx`, `Results.jsx`, `Navbar.jsx`)
**Goal**: Connect ECI Officer actions directly to the live EVM ballot and Results page, and ensure the UI scales cleanly for large candidate/voter lists.

**Tasks for AI Agent**:
1. **Upgrade `/src/pages/EciRegister.jsx`**:
   - Keep all existing inputs (`Aadhaar Number`, `Voter Number`, `First Name`, `Last Name`, `Email`, `Phone Number`, `Party Name`, `Profile Picture`).
   - Add an optional **Party Logo / Symbol** file input (defaulting to `eci-logo.png` if not uploaded) so newly registered candidates have both a candidate photo and a party logo on `/src/pages/Vote.jsx`.
   - When submitted, append the new candidate to `eci_candidates` (right before `NOTA`) with `votes: 0` so it immediately appears on both `Vote.jsx` and `Results.jsx`.
2. **Upgrade `/src/pages/Results.jsx`**:
   - Keep the existing `.results-table` layout and columns (`Candidate`, `Party`, `Votes`).
   - Add a **Search / Filter bar** above the table (styled with `#004d99` focus border) and a **Total Votes Cast** summary row at the bottom so the table remains easy to navigate even when many candidates are registered.
   - Highlight the leading candidate row or display a subtle `"Leading"` badge next to the highest vote getter (excluding NOTA).
   - Include a **VVPAT Receipt Verifier** input box where a voter can paste their `VVPAT-IND-2026-XXXXXX` receipt code to verify that their ballot is recorded in the tally (without revealing which candidate they voted for).
3. **Bilingual Toggle (`English` / `हिन्दी`) in `Navbar.jsx`**:
   - Add a compact `EN | हिं` toggle link in the navbar (`text-white hover:text-[#f4c542]`) that switches UI labels between English and Hindi (हिन्दी) for nationwide Indian accessibility while keeping the exact navbar height and layout.

---

## 3. Verification Checklist for AI Agents
Before completing any task from this plan, verify:
- [ ] **Assets Check**: All 18 original image files in `/` (`eci-logo.png`, `g20-logo.png`, `75-years-logo.png`, `default-avatar.png`, `candidate1.jpg`–`candidate6.jpg`, `logo1.png`–`logo6.png`, `nota.jpg`, `nota.png`) are present and imported via `/src/assets.js`.
- [ ] **Colors & Layout Check**: Navbar/Footer use `#002d72`, headings/buttons use `#004d99` / `#0359b4`, background uses `linear-gradient(to bottom, #f9bb7c, #FFFFFF, #92f589)`, and cards use `shadow-[5px_3px_5px_grey]`.
- [ ] **JSX & Tailwind Only**: No `.tsx` files and no separate page `.css` files; all styling uses Tailwind CSS utility classes.
- [ ] **Build Check**: Run `compile_applet` (`npm run build`) and confirm zero errors.
