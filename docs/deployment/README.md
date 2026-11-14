# Online Voting System (OVS) — Deployment & Operations Documentation Suite

**Phase 8.13: Production Deployment, DevOps Automation, CI/CD, Observability, Backup & Disaster Recovery**

This directory contains the operational and deployment architecture documentation for the Online Voting System (OVS) platform.

> [!NOTE]
> OVS is an educational Indian election simulation and research platform. It is not an official, legally binding election system. All synthetic data, candidate rosters, and tally outputs are simulated.

---

## Documentation Index

| Document | Purpose & Scope |
| :--- | :--- |
| **[Preflight Audit Report](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/PHASE_8_13_PREFLIGHT_AUDIT.md)** | Initial comprehensive preflight audit findings (C1–C3, H1–H4, M1–M4) and resolution tracking. |
| **[Production Deployment Architecture](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/PRODUCTION_DEPLOYMENT.md)** | Production topology, Docker Compose production stack, multi-stage containers, Nginx reverse proxy, and zero-downtime blue/green deployment strategy. |
| **[Environment Configuration](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/ENVIRONMENT_CONFIGURATION.md)** | Specification of `development`, `test`, `staging`, and `production` environments, strict Zod validation, and provider-neutral secret management. |
| **[CI/CD Pipeline](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/CI_CD_PIPELINE.md)** | GitHub Actions 16-step continuous verification pipeline, release packaging, container builds, and Software Bill of Materials (SBOM). |
| **[Observability & Monitoring](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/OBSERVABILITY.md)** | Zero-dependency Prometheus `/metrics` exposition, route sanitization (preventing label cardinality explosion), structured Pino logging, and alert definitions. |
| **[Database Backup & Recovery](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/DATABASE_BACKUP_AND_RECOVERY.md)** | Executable logical backups (`pg_dump -Fc`), SHA-256 verification, AES-256 encryption, retention policies, and non-destructive restore verification into isolated test databases. |
| **[Disaster Recovery Runbook](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/DISASTER_RECOVERY_RUNBOOK.md)** | Comprehensive runbook covering 10 major operational disaster scenarios with step-by-step containment, recovery, verification, and RTO/RPO targets. |
| **[Security Hardening Guide](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/SECURITY_HARDENING.md)** | Defense-in-depth security: non-root container runners, network isolation, rate limiting, CSRF protection, and audit log redaction. |
| **[Performance & Capacity](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/PERFORMANCE_AND_CAPACITY.md)** | Synthetic performance smoke benchmarking, concurrency profiling, latency percentiles (p50, p95, p99), and horizontal capacity planning. |
| **[Rollback Procedures](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/ROLLBACK_PROCEDURE.md)** | Decision matrix and actionable runbooks for application rollbacks, database expand-and-contract schema rollbacks, and data restoration. |
| **[Phase 8.13 Implementation Report](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docs/deployment/PHASE_8_13_IMPLEMENTATION_REPORT.md)** | Formal sign-off, automated test results, readiness classification, and transition boundary. |

---

## Infrastructure Artifacts

- **Docker Compose Production:** [docker-compose.production.yml](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docker-compose.production.yml)
- **Backend Dockerfile:** [backend/Dockerfile](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/backend/Dockerfile)
- **Frontend Dockerfile:** [Dockerfile.frontend](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/Dockerfile.frontend)
- **Nginx Reverse Proxy Config:** [docker/nginx/nginx.conf](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/docker/nginx/nginx.conf)
- **Backup & Verification Scripts:**
  - [scripts/backup/backup.sh](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/scripts/backup/backup.sh) & [scripts/backup/backup.ps1](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/scripts/backup/backup.ps1)
  - [scripts/backup/restore-verify.sh](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/scripts/backup/restore-verify.sh) & [scripts/backup/restore-verify.ps1](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/scripts/backup/restore-verify.ps1)
- **Performance Benchmark Script:** [scripts/perf/smoke-perf.mjs](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/scripts/perf/smoke-perf.mjs)
- **Terraform Reference Templates:** [infra/terraform/](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/infra/terraform/main.tf)
