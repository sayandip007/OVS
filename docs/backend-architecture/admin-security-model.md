# OVS Phase 8.4 — Administrative Security & Audit Controls

## 1. Defense-in-Depth Control Inventory

| Control Area | Implementation Details | Verification |
| :--- | :--- | :--- |
| **Password Hashing** | Node.js OpenSSL `crypto.scrypt` (`N=16384, r=8, p=1`, 16-byte random salt, 64-byte key, PHC string serialization) + `crypto.timingSafeEqual`. | Verified in `admin.unit.test.ts` |
| **Password Policy** | Min 12 chars, max 128 chars, uppercase + lowercase + digit + special char, forbids officerCode/email username substrings & edge whitespace. | Verified in `admin.unit.test.ts` |
| **Session Cookies** | Opaque 256-bit random token; only SHA-256 hash stored in `user_sessions.id`. Issued via `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` (production). | Verified in unit & integration tests |
| **Session Fixation Defense** | `loginAdmin` & `verifyOtp` delete any existing `ovs_session` cookie hash presented by the client before issuing a new session. | Verified in `admin.unit.test.ts` |
| **Idle & Absolute Expiry** | 8h absolute lifetime + 30-minute idle timeout via `UserSession.lastActivityAt`. | Enforced in `auth.service.ts` |
| **CSRF Protection** | HMAC-SHA256 synchronizer token tied to raw session token, verified in constant time via `X-CSRF-Token` on all mutating admin requests (`POST`, `PUT`, `PATCH`, `DELETE`). | Verified in unit & integration tests |
| **Brute-Force Lockout & Rate Limiting** | Progressive per-account lockout after 5 failed attempts (15-min lockout) + per-IP Express rate limiter (`10 req / 15 min`). | Verified in `admin.unit.test.ts` |
| **Account Enumeration Resistance** | Dummy scrypt timing equalization on unknown emails + identical `401 Invalid administrator credentials.` message for unknown email, wrong password, and locked accounts. Voter accounts rejected uniformly. | Verified in `admin.unit.test.ts` |
| **Suspension & Revocation** | `suspend` / `deactivate` atomically sets `AdminUser.status`, `User.isActive = false`, and deletes all active `UserSession` rows. | Verified in unit & PostgreSQL integration tests |
| **Mass Assignment / IDOR** | All Zod request schemas apply `.strict()`; target lookups and scope checks resolve authority exclusively from authenticated DB session. | Verified in unit & PostgreSQL integration tests |

---

## 2. Append-Only Security Audit Logging (`admin_action_logs`)

Managed by [`admin.audit.service.ts`](file:///backend/src/modules/admin/admin.audit.service.ts):
- Records actor (`adminUserId`, `actorUserId`, `actorIdentifier`, `actorRole`), `actionType`, `domain`, `targetEntityId`, `outcome` (`SUCCESS`, `FAILURE`, `DENIED`), `requestId`, `ipAddress`, `userAgent`, and `timestamp`.
- Recursively redacts sensitive fields (`password`, `passwordHash`, `newPassword`, `sessionToken`, `csrfToken`, `otp`, `authorization`, `cookie`) before persistence and in Pino HTTP logs.
- No update (`PUT`/`PATCH`) or delete (`DELETE`) API routes or repository mutators exist for `AdminActionLog`.
- Uses `onDelete: SetNull` on `adminUserId` so historical audit records remain intact indefinitely.
