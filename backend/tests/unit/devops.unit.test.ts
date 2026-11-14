import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { envSchema } from '../../src/config/env.js';
import {
  EnvironmentSecretProvider,
  getSecretProvider,
  type SecretProvider,
} from '../../src/config/secrets.js';
import {
  sanitizeRoutePath,
  generatePrometheusMetrics,
  recordHttpRequest,
  resetMetricsForTesting,
} from '../../src/modules/observability/metrics.js';

describe('OVS Phase 8.13 — DevOps, Environment, Observability & Disaster Recovery Suite', () => {

  describe('1. Environment Configuration & Production Hardening', () => {
    test('accepts valid development configuration', () => {
      const devConfig = {
        NODE_ENV: 'development',
        PORT: '5000',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ovs_dev',
        SESSION_SECRET: 'any_dev_secret_value_minimum_16_chars',
      };
      const result = envSchema.safeParse(devConfig);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.NODE_ENV, 'development');
        assert.equal(result.data.PORT, 5000);
      }
    });

    test('accepts valid staging configuration with secure secret', () => {
      const stagingConfig = {
        NODE_ENV: 'staging',
        PORT: '5000',
        DATABASE_URL: 'postgresql://staging_user:prod_pass_123@db.staging.internal:5432/ovs_staging',
        SESSION_SECRET: 'super_secret_staging_production_grade_token_2026_xyz',
      };
      const result = envSchema.safeParse(stagingConfig);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.NODE_ENV, 'staging');
      }
    });

    test('rejects production configuration when SESSION_SECRET is too short', () => {
      const prodConfig = {
        NODE_ENV: 'production',
        PORT: '5000',
        DATABASE_URL: 'postgresql://prod_user:secret_prod_pass@db.internal:5432/ovs_prod',
        SESSION_SECRET: 'short_secret',
      };
      const result = envSchema.safeParse(prodConfig);
      assert.equal(result.success, false);
      assert.match(result.error.errors[0]?.message ?? '', /at least 32 characters/);
    });

    test('rejects production configuration with development placeholder secret', () => {
      const prodConfig = {
        NODE_ENV: 'production',
        PORT: '5000',
        DATABASE_URL: 'postgresql://prod_user:secret_prod_pass@db.internal:5432/ovs_prod',
        SESSION_SECRET: 'dev_session_secret_32_characters_long_min',
      };
      const result = envSchema.safeParse(prodConfig);
      assert.equal(result.success, false);
      assert.match(result.error.errors[0]?.message ?? '', /Insecure placeholder SESSION_SECRET/i);
    });

    test('rejects production configuration when DATABASE_URL is not postgresql', () => {
      const prodConfig = {
        NODE_ENV: 'production',
        PORT: '5000',
        DATABASE_URL: 'mysql://prod_user:pass@localhost:3306/ovs_prod',
        SESSION_SECRET: 'production_secure_secret_entropy_token_at_least_32_bytes',
      };
      const result = envSchema.safeParse(prodConfig);
      assert.equal(result.success, false);
      assert.match(result.error.errors[0]?.message ?? '', /PostgreSQL connection URI/);
    });

    test('accepts hardened production configuration', () => {
      const prodConfig = {
        NODE_ENV: 'production',
        PORT: '5000',
        DATABASE_URL: 'postgresql://prod_user:strong_prod_pass_2026@db-cluster.ovs.internal:5432/ovs_prod?schema=public',
        SESSION_SECRET: 'production_secure_secret_entropy_token_at_least_32_bytes_long',
        LOG_LEVEL: 'warn',
        RATE_LIMIT_MAX: '200',
      };
      const result = envSchema.safeParse(prodConfig);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.NODE_ENV, 'production');
        assert.equal(result.data.LOG_LEVEL, 'warn');
        assert.equal(result.data.RATE_LIMIT_MAX, 200);
      }
    });
  });

  describe('2. Provider-Neutral Secret Management', () => {
    test('EnvironmentSecretProvider returns value from process.env', async () => {
      process.env.TEST_SECRET_KEY = 'val_secret_123';
      const provider = new EnvironmentSecretProvider();
      const val = await provider.getSecret('TEST_SECRET_KEY');
      assert.equal(val, 'val_secret_123');
      delete process.env.TEST_SECRET_KEY;
    });

    test('EnvironmentSecretProvider falls back or returns undefined when missing', async () => {
      const provider = new EnvironmentSecretProvider();
      const val = await provider.getSecret('NON_EXISTENT_KEY_123', 'fallback_val');
      assert.equal(val, 'fallback_val');

      const missingVal = await provider.getSecret('NON_EXISTENT_KEY_123');
      assert.equal(missingVal, undefined);
    });

    test('EnvironmentSecretProvider throws on getRequiredSecret when missing', async () => {
      const provider = new EnvironmentSecretProvider();
      await assert.rejects(
        async () => {
          await provider.getRequiredSecret('MANDATORY_MISSING_SECRET');
        },
        /Required secret 'MANDATORY_MISSING_SECRET' is missing from environment/
      );
    });

    test('custom SecretProvider implementation behaves correctly', async () => {
      const memoryStore: Record<string, string> = {
        'DATABASE_PASSWORD': 'super_secure_vault_pass',
      };
      const customProvider: SecretProvider = {
        name: 'InMemoryVault',
        async getSecret(key: string, fallback?: string): Promise<string | undefined> {
          return memoryStore[key] ?? fallback;
        },
        async getRequiredSecret(key: string): Promise<string> {
          const val = memoryStore[key];
          if (!val) throw new Error(`Missing ${key}`);
          return val;
        },
        async requireSecret(key: string): Promise<string> {
          return this.getRequiredSecret(key);
        },
      };

      const pw = await customProvider.getRequiredSecret('DATABASE_PASSWORD');
      assert.equal(pw, 'super_secure_vault_pass');
    });
  });

  describe('3. Zero-Dependency Prometheus Metrics & Observability', () => {
    test('sanitizeRoutePath sanitizes dynamic parameters, IDs, and UUIDs', () => {
      assert.equal(sanitizeRoutePath('/api/v1/health'), '/api/v1/health');
      assert.equal(sanitizeRoutePath('/api/v1/system/public-config'), '/api/v1/system/public-config');
      assert.equal(
        sanitizeRoutePath('/api/v1/elections/550e8400-e29b-41d4-a716-446655440000'),
        '/api/v1/elections/:id'
      );
      assert.equal(sanitizeRoutePath('/api/v1/voters/12345/profile'), '/api/v1/voters/:id/profile');
      assert.equal(sanitizeRoutePath('/api/v1/candidates?page=1&limit=20'), '/api/v1/candidates');
      assert.equal(sanitizeRoutePath(''), '/');
    });

    test('recordHttpRequest updates counters and histogram buckets', async () => {
      resetMetricsForTesting();
      recordHttpRequest('GET', '/api/v1/elections', 200, 0.045);
      recordHttpRequest('GET', '/api/v1/elections', 200, 0.120);
      recordHttpRequest('POST', '/api/v1/auth/login', 401, 0.015);

      const exposition = await generatePrometheusMetrics();

      assert.match(exposition, /# HELP ovs_http_requests_total/);
      assert.match(exposition, /# TYPE ovs_http_requests_total counter/);
      assert.match(exposition, /ovs_http_requests_total\{method="GET",status="200",route="\/api\/v1\/elections"\} 2/);
      assert.match(exposition, /ovs_http_requests_total\{method="POST",status="401",route="\/api\/v1\/auth\/login"\} 1/);

      assert.match(exposition, /# HELP ovs_http_request_duration_seconds/);
      assert.match(exposition, /# TYPE ovs_http_request_duration_seconds histogram/);
      assert.match(exposition, /ovs_http_request_duration_seconds_count\{method="GET",status="200",route="\/api\/v1\/elections"\} 2/);
    });

    test('metrics exposition contains process CPU, memory, and uptime', async () => {
      const exposition = await generatePrometheusMetrics();

      assert.match(exposition, /process_cpu_user_seconds_total/);
      assert.match(exposition, /process_resident_memory_bytes/);
      assert.match(exposition, /process_uptime_seconds/);
      assert.match(exposition, /ovs_build_info\{version="1\.0\.0",node_env="(development|test)"\} 1/);

      // Verify privacy guarantee: zero personal voter details or choices in metrics
      assert.doesNotMatch(exposition, /voter/i);
      assert.doesNotMatch(exposition, /candidate_choice/i);
    });
  });

  describe('4. Disaster Recovery & Docker Infrastructure Invariants', () => {
    test('backup and restore verification scripts exist and have safety guards', () => {
      const rootDir = path.resolve(process.cwd());
      const backupSh = path.join(rootDir, 'scripts/backup/backup.sh');
      const restoreSh = path.join(rootDir, 'scripts/backup/restore-verify.sh');
      const backupPs1 = path.join(rootDir, 'scripts/backup/backup.ps1');
      const restorePs1 = path.join(rootDir, 'scripts/backup/restore-verify.ps1');

      assert.equal(fs.existsSync(backupSh), true, 'backup.sh must exist');
      assert.equal(fs.existsSync(restoreSh), true, 'restore-verify.sh must exist');
      assert.equal(fs.existsSync(backupPs1), true, 'backup.ps1 must exist');
      assert.equal(fs.existsSync(restorePs1), true, 'restore-verify.ps1 must exist');

      // Verify non-destructive invariant: restore-verify must abort if target equals production DB
      const restoreShContent = fs.readFileSync(restoreSh, 'utf-8');
      assert.match(restoreShContent, /FATAL SAFETY VIOLATION/);
      assert.match(restoreShContent, /equals production database/);

      const restorePs1Content = fs.readFileSync(restorePs1, 'utf-8');
      assert.match(restorePs1Content, /Verify database cannot be the production database/);
    });

    test('production docker-compose and dockerfiles enforce isolation and non-root runner', () => {
      const rootDir = path.resolve(process.cwd());
      const composeProd = path.join(rootDir, 'docker-compose.production.yml');
      const backendDocker = path.join(rootDir, 'backend/Dockerfile');
      const frontendDocker = path.join(rootDir, 'Dockerfile.frontend');
      const nginxConf = path.join(rootDir, 'docker/nginx/nginx.conf');

      assert.equal(fs.existsSync(composeProd), true, 'docker-compose.production.yml must exist');
      assert.equal(fs.existsSync(backendDocker), true, 'backend/Dockerfile must exist');
      assert.equal(fs.existsSync(frontendDocker), true, 'Dockerfile.frontend must exist');
      assert.equal(fs.existsSync(nginxConf), true, 'nginx.conf must exist');

      const backendDockerContent = fs.readFileSync(backendDocker, 'utf-8');
      assert.match(backendDockerContent, /USER node/, 'Backend Dockerfile must run as unprivileged non-root user');
      assert.match(backendDockerContent, /HEALTHCHECK/, 'Backend Dockerfile must declare HEALTHCHECK');

      const frontendDockerContent = fs.readFileSync(frontendDocker, 'utf-8');
      assert.match(frontendDockerContent, /HEALTHCHECK/, 'Frontend Dockerfile must declare HEALTHCHECK');

      const composeContent = fs.readFileSync(composeProd, 'utf-8');
      assert.match(composeContent, /postgres-db:/);
      assert.match(composeContent, /backend-api:/);
      assert.match(composeContent, /frontend-proxy:/);
      assert.match(composeContent, /ovs_prod_pgdata:/);
      assert.match(composeContent, /ovs_internal_net:/);
    });

    test('Terraform reference templates declare three-tier topology', () => {
      const rootDir = path.resolve(process.cwd());
      const tfMain = path.join(rootDir, 'infra/terraform/main.tf');
      const tfVars = path.join(rootDir, 'infra/terraform/variables.tf');
      const tfOut = path.join(rootDir, 'infra/terraform/outputs.tf');

      assert.equal(fs.existsSync(tfMain), true, 'main.tf must exist');
      assert.equal(fs.existsSync(tfVars), true, 'variables.tf must exist');
      assert.equal(fs.existsSync(tfOut), true, 'outputs.tf must exist');

      const tfMainContent = fs.readFileSync(tfMain, 'utf-8');
      assert.match(tfMainContent, /network_topology/);
      assert.match(tfMainContent, /managed_postgres/);
      assert.match(tfMainContent, /backend_service/);
      assert.match(tfMainContent, /edge_load_balancer/);
    });
  });

  describe('5. Synthetic Performance Smoke Test Suite', () => {
    test('calculatePercentile calculates p50, p95, p99 on sorted latency arrays', async () => {
      const { calculatePercentile } = await import('../../../scripts/perf/smoke-perf.mjs');
      const latencies = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

      assert.equal(calculatePercentile(latencies, 50), 25);
      assert.equal(calculatePercentile(latencies, 90), 45);
      assert.equal(calculatePercentile(latencies, 100), 50);
      assert.equal(calculatePercentile([], 50), 0);
    });

    test('runBenchmark calculates throughput, success rate and percentiles accurately', async () => {
      const { runBenchmark } = await import('../../../scripts/perf/smoke-perf.mjs');

      // Inject deterministic simulated responses
      let callCount = 0;
      const simulatedSendRequest = async (_url: string) => {
        callCount++;
        return {
          statusCode: 200,
          durationMs: 10 + (callCount % 5),
          success: true,
        };
      };

      const report = await runBenchmark({
        targetUrl: 'http://localhost:5000',
        totalRequests: 25,
        concurrency: 5,
        endpoints: ['/api/v1/health', '/api/v1/system/public-config'],
        sendRequestFn: simulatedSendRequest,
      });

      assert.equal(report.totalRequests, 25);
      assert.equal(report.successes, 25);
      assert.equal(report.failures, 0);
      assert.equal(report.rps > 0, true);
      assert.equal(report.p50Ms >= 10, true);
      assert.equal(report.p95Ms >= 10, true);
      assert.equal(report.maxMs >= report.minMs, true);
    });
  });
});
