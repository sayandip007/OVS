# OVS Environment & Configuration Specification

## 1. Supported Environments

OVS defines four distinct runtime environments:

| Environment | Purpose | Validation Stricitness | Secrets Policy |
| :--- | :--- | :--- | :--- |
| `development` | Local workstation development | Permissive; default dev secrets allowed | Placeholder keys accepted |
| `test` | Automated unit & integration testing | Permissive; mocked memory databases | Test keys accepted |
| `staging` | Pre-production testing environment | **Strict production-grade validation** | High-entropy secrets required |
| `production` | Live deployment simulation | **Strict production-grade validation** | High-entropy secrets mandatory |

---

## 2. Environment Variables Matrix

All backend environment variables are parsed and strictly validated by Zod at startup in `backend/src/config/env.ts`.

| Variable | Type | Default | Required? | Validation Rules | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Enum | `development` | Yes | `development`, `test`, `staging`, `production` | Operating environment |
| `PORT` | Number | `5000` | No | Integer `1`–`65535` | HTTP listening port |
| `DATABASE_URL` | String | - | Yes | Must start with `postgresql://` or `postgres://` | PostgreSQL connection string |
| `SESSION_SECRET` | String | - | Yes | >= 32 characters; no dev placeholders in prod/staging | HMAC secret for session cookies |
| `CLIENT_ORIGIN` | String | `http://localhost:3000` | No | Comma-separated valid HTTP/HTTPS URLs | Permitted CORS origins |
| `LOG_LEVEL` | Enum | `info` | No | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` | Pino log level threshold |
| `RATE_LIMIT_MAX` | Number | `120` | No | Positive integer | Max requests per IP per minute |
| `REDIS_URL` | String | - | No | Valid URI if present | Optional cache/session store |

### Production Anti-Placeholder Protection
In `staging` and `production`, the server immediately aborts startup with an exit code 1 if `SESSION_SECRET` contains any known placeholder strings:
- `replace-with`
- `dev-secret`
- `dev_session_secret`
- `changeme`

---

## 3. Provider-Neutral Secret Management (`SecretProvider`)

To ensure OVS can run on AWS, GCP, Azure, or on-premise without vendor lock-in, secrets are resolved through the `SecretProvider` interface defined in `backend/src/config/secrets.ts`:

```typescript
export interface SecretProvider {
  name?: string;
  getSecret(key: string, fallback?: string): Promise<string | undefined>;
  getRequiredSecret(key: string): Promise<string>;
  requireSecret?(key: string): Promise<string>;
}
```

### Implementations:
1. **`EnvironmentSecretProvider` (Default):** Resolves secrets from `process.env`.
2. **Cloud KMS / Vault Adapters:** Can be registered via `setSecretProvider(customProvider)` at runtime bootstrap without altering business logic modules.
