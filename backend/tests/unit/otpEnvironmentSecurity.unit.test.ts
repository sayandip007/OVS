/**
 * OVS Phase 8.15.1 — OTP Provider & Environment Security Unit Test Suite
 *
 * Verifies:
 *  1. Provider selection across development, test, staging, and production.
 *  2. Refusal of DevelopmentOtpProvider in production/staging.
 *  3. Inability to inspect OTPs in staging and production under all circumstances.
 *  4. Explicit gating of OTP inspection via ALLOW_OTP_INSPECTION=true.
 *  5. ProductionDisabledOtpProvider fail-closed behavior (no false delivery success).
 *  6. Auth router route mount gating for /dev/latest-otp and /dev/otp/:identifier.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import {
  DevelopmentOtpProvider,
  ProductionDisabledOtpProvider,
  resolveOtpProvider,
  OtpService,
} from '../../src/modules/auth/otp.service.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';
import { parseEnvironment } from '../../src/config/env.js';

describe('OVS Phase 8.15.1 — OTP Provider & Environment Security Suite', () => {
  describe('1. Environment Provider Resolution (resolveOtpProvider)', () => {
    test('resolves DevelopmentOtpProvider in development and test environments', () => {
      const devProvider = resolveOtpProvider(undefined, 'development');
      assert.equal(devProvider.name, 'DevelopmentOtpProvider');

      const testProvider = resolveOtpProvider(undefined, 'test');
      assert.equal(testProvider.name, 'DevelopmentOtpProvider');
    });

    test('resolves ProductionDisabledOtpProvider in production and staging environments', () => {
      const prodProvider = resolveOtpProvider(undefined, 'production');
      assert.equal(prodProvider.name, 'ProductionDisabledOtpProvider');

      const stagingProvider = resolveOtpProvider(undefined, 'staging');
      assert.equal(stagingProvider.name, 'ProductionDisabledOtpProvider');
    });

    test('respects explicitly injected provider regardless of environment', () => {
      class CustomMockProvider {
        readonly name = 'CustomMockProvider';
        async sendOtp() {
          return true;
        }
      }
      const custom = new CustomMockProvider() as any;
      const resolved = resolveOtpProvider(custom, 'production');
      assert.equal(resolved.name, 'CustomMockProvider');
    });
  });

  describe('2. Inspection Blocking & In-Memory Store Protection', () => {
    test('DevelopmentOtpProvider blocks inspection if ALLOW_OTP_INSPECTION is not "true"', async () => {
      const originalFlag = process.env.ALLOW_OTP_INSPECTION;
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        delete process.env.ALLOW_OTP_INSPECTION;

        const provider = new DevelopmentOtpProvider();
        await provider.sendOtp('WBX1234567', '9800000000', '123456');

        assert.equal(
          provider.getLastOtp('WBX1234567'),
          null,
          'Must return null when ALLOW_OTP_INSPECTION is not true'
        );
      } finally {
        process.env.ALLOW_OTP_INSPECTION = originalFlag;
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('DevelopmentOtpProvider allows inspection in development when ALLOW_OTP_INSPECTION=true', async () => {
      const originalFlag = process.env.ALLOW_OTP_INSPECTION;
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        process.env.ALLOW_OTP_INSPECTION = 'true';

        const provider = new DevelopmentOtpProvider();
        await provider.sendOtp('WBX1234567', '9800000000', '654321');

        assert.equal(
          provider.getLastOtp('WBX1234567'),
          '654321',
          'Must return OTP when inspection is explicitly enabled in development'
        );
      } finally {
        process.env.ALLOW_OTP_INSPECTION = originalFlag;
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('DevelopmentOtpProvider strictly returns null in production or staging even if ALLOW_OTP_INSPECTION=true', async () => {
      const originalFlag = process.env.ALLOW_OTP_INSPECTION;
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.ALLOW_OTP_INSPECTION = 'true';

        process.env.NODE_ENV = 'production';
        const prodProvider = new DevelopmentOtpProvider();
        await prodProvider.sendOtp('PROD-ID', '9800000000', '999999');
        assert.equal(prodProvider.getLastOtp('PROD-ID'), null);

        process.env.NODE_ENV = 'staging';
        const stagingProvider = new DevelopmentOtpProvider();
        await stagingProvider.sendOtp('STAGE-ID', '9800000000', '888888');
        assert.equal(stagingProvider.getLastOtp('STAGE-ID'), null);
      } finally {
        process.env.ALLOW_OTP_INSPECTION = originalFlag;
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('3. ProductionDisabledOtpProvider Fail-Closed Behavior', () => {
    test('refuses to simulate delivery and throws SMS_DELIVERY_UNAVAILABLE', async () => {
      const provider = new ProductionDisabledOtpProvider();
      await assert.rejects(
        async () => provider.sendOtp('VOTER-01', '9800000000', '123456'),
        (err: Error) => {
          assert.match(err.message, /SMS_DELIVERY_UNAVAILABLE/);
          return true;
        }
      );
      assert.equal(provider.getLastOtp('VOTER-01'), null);
    });
  });

  describe('4. Auth Router Route Mount Protection', () => {
    const hasDevRoute = (router: any) =>
      router.stack.some(
        (layer: any) =>
          layer.route?.path === '/dev/latest-otp' ||
          layer.route?.path === '/dev/otp/:identifier'
      );

    test('does NOT mount /dev/latest-otp or /dev/otp/:id in staging or production', () => {
      const stagingRouter = createAuthRouter({
        nodeEnv: 'staging',
        allowOtpInspection: false,
        enableRateLimit: false,
      });
      assert.equal(hasDevRoute(stagingRouter), false, 'Must not mount dev routes in staging');

      const prodRouter = createAuthRouter({
        nodeEnv: 'production',
        allowOtpInspection: false,
        enableRateLimit: false,
      });
      assert.equal(hasDevRoute(prodRouter), false, 'Must not mount dev routes in production');
    });

    test('mounts /dev/latest-otp in development only when allowOtpInspection is true', () => {
      const routerDisabled = createAuthRouter({
        nodeEnv: 'development',
        allowOtpInspection: false,
        enableRateLimit: false,
      });
      assert.equal(hasDevRoute(routerDisabled), false, 'Must not mount when allowOtpInspection is false');

      const routerEnabled = createAuthRouter({
        nodeEnv: 'development',
        allowOtpInspection: true,
        enableRateLimit: false,
      });
      assert.equal(hasDevRoute(routerEnabled), true, 'Must mount when allowOtpInspection is true in dev');
    });
  });

  describe('5. Environment Zod Validation Schema Protection', () => {
    test('rejects ALLOW_OTP_INSPECTION=true when NODE_ENV=production or staging', () => {
      assert.throws(
        () =>
          parseEnvironment({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://usr:pwd@localhost:5432/ovs_db',
            SESSION_SECRET: 'a_very_long_valid_secret_key_32_characters_minimum',
            ALLOW_OTP_INSPECTION: 'true',
          }),
        (err: Error) => {
          assert.match(err.message, /ALLOW_OTP_INSPECTION is strictly forbidden when NODE_ENV=production/);
          return true;
        }
      );

      assert.throws(
        () =>
          parseEnvironment({
            NODE_ENV: 'staging',
            DATABASE_URL: 'postgresql://usr:pwd@localhost:5432/ovs_db',
            SESSION_SECRET: 'a_very_long_valid_secret_key_32_characters_minimum',
            ALLOW_OTP_INSPECTION: 'true',
          }),
        (err: Error) => {
          assert.match(err.message, /ALLOW_OTP_INSPECTION is strictly forbidden when NODE_ENV=staging/);
          return true;
        }
      );
    });
  });
});
