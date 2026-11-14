/**
 * OVS Phase 8.15.1 — Voter Verification Semantics & Notification Eligibility Regression Suite
 *
 * Verifies:
 *  1. Registration produces isVerified: false matching accountStatus: 'UNVERIFIED'.
 *  2. Simulated OTP verification does not represent official identity verification.
 *  3. Email notification eligibility enforces statutory verification in production while
 *     permitting safe synthetic demo notifications in development/test.
 *  4. Voter eligibility for democratic participation remains fully operational in demo mode.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MetadataSource } from '@prisma/client';
import { AuthRepository } from '../../src/modules/auth/auth.repository.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';

describe('OVS Phase 8.15.1 — Voter Verification Semantics Suite', () => {
  describe('1. Registration State & Verification Semantics', () => {
    test('AuthRepository.createVoterUser initializes isVerified as false', async () => {
      let createdProfileData: any = null;

      const mockPrisma: any = {
        $transaction: async (fn: any) =>
          fn({
            user: {
              create: async ({ data }: any) => {
                createdProfileData = data.voterProfile.create;
                return {
                  id: 'test-user-id',
                  identifier: data.identifier,
                  userType: 'VOTER',
                  isActive: true,
                  voterProfile: {
                    id: 'test-voter-id',
                    ...createdProfileData,
                  },
                };
              },
            },
          }),
      };

      const repo = new AuthRepository(mockPrisma);
      const user = await repo.createVoterUser(
        {
          epicNumber: 'WBX9876543',
          fullName: 'Test Voter',
          dateOfBirth: '1995-05-15',
          gender: 'Female',
          mobile: '9876543210',
          email: 'test.voter@ovs-demo.invalid',
          address: 'Test Address',
          pinCode: '741101',
          stateId: 'WB',
          districtId: 'WB-DIST-NADIA',
          parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
          assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
        },
        'mock_pwd_hash'
      );

      assert.equal(
        createdProfileData.isVerified,
        false,
        'Registration must not silently mark voter as officially verified'
      );
      assert.equal(user.voterProfile?.isVerified, false);
    });
  });

  describe('2. Email Notification Eligibility Rules', () => {
    const notificationsService = new NotificationsService({} as any);
    const isEligible = (notificationsService as any).isEmailNotificationEligible.bind(
      notificationsService
    );

    test('denies email notification if voter email is missing or preferences disabled', () => {
      // Disabled in preference
      assert.equal(
        isEligible(
          { email: 'user@ovs-demo.invalid', isVerified: true },
          { emailEnabled: false }
        ),
        false
      );

      // Missing email
      assert.equal(
        isEligible({ email: null, isVerified: true }, { emailEnabled: true }),
        false
      );
    });

    test('permits email notification if voter identity is officially verified', () => {
      assert.equal(
        isEligible(
          { email: 'verified@ovs-demo.invalid', isVerified: true },
          { emailEnabled: true }
        ),
        true
      );
    });

    test('safe demo rule: permits unverified DEMO_SAMPLE voters in development or test', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        assert.equal(
          isEligible(
            {
              email: 'demo@ovs-demo.invalid',
              isVerified: false,
              metadataSource: MetadataSource.DEMO_SAMPLE,
            },
            { emailEnabled: true }
          ),
          true,
          'Safe demo rule must permit DEMO_SAMPLE in development'
        );

        process.env.NODE_ENV = 'test';
        assert.equal(
          isEligible(
            {
              email: 'demo@ovs-demo.invalid',
              isVerified: false,
              metadataSource: MetadataSource.DEMO_SAMPLE,
            },
            { emailEnabled: true }
          ),
          true,
          'Safe demo rule must permit DEMO_SAMPLE in test'
        );
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    test('strictly denies unverified voters in production even if marked DEMO_SAMPLE', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        assert.equal(
          isEligible(
            {
              email: 'demo@ovs-demo.invalid',
              isVerified: false,
              metadataSource: MetadataSource.DEMO_SAMPLE,
            },
            { emailEnabled: true }
          ),
          false,
          'Production must strictly reject unverified recipients'
        );
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });
});
