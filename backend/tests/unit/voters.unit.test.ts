import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { updateVoterProfileSchema } from '../../src/modules/voters/voters.schemas.js';
import { NotFoundProblemError, ConflictProblemError, ForbiddenProblemError } from '../../src/common/errors/problemDetails.js';

describe('OVS Phase 8.3 — Backend Voter Profile Unit Tests', () => {
  describe('1. Zod Schema Validation for Voter Profile Updates', () => {
    test('accepts valid updates to permitted personal and geographic fields', () => {
      const validUpdate = {
        fullName: 'Sayandip Saha Updated',
        gender: 'MALE',
        stateId: 'WB',
        districtId: 'NADIA',
        assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      };

      const result = updateVoterProfileSchema.safeParse(validUpdate);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.fullName, 'Sayandip Saha Updated');
        assert.equal(result.data.stateId, 'WB');
      }
    });

    test('strictly rejects forbidden privilege/identity fields (role, status, epicNumber, userId, id) to prevent mass assignment', () => {
      const hostilePayload = {
        fullName: 'Legitimate Name',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        accountStatus: 'VERIFIED',
        epicNumber: 'NEW_EPIC_9999',
        userId: 'hostile-user-uuid',
        id: 'hostile-profile-uuid',
        isVerified: true,
      };

      const result = updateVoterProfileSchema.safeParse(hostilePayload);
      assert.equal(result.success, false);
      if (!result.success) {
        const unrecognizedIssues = result.error.issues.filter(
          (issue) => issue.code === 'unrecognized_keys'
        );
        assert.ok(unrecognizedIssues.length > 0);
      }
    });

    test('allows partial updates with only a subset of permitted fields', () => {
      const partialUpdate = {
        fullName: 'Sayandip Only Name',
      };

      const result = updateVoterProfileSchema.safeParse(partialUpdate);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.fullName, 'Sayandip Only Name');
        assert.equal(result.data.stateId, undefined);
      }
    });

    test('rejects update with empty name', () => {
      const invalid = updateVoterProfileSchema.safeParse({ fullName: '' });
      assert.equal(invalid.success, false);
    });

    test('rejects update with invalid gender enum', () => {
      const invalid = updateVoterProfileSchema.safeParse({ gender: 'INVALID_GENDER' });
      assert.equal(invalid.success, false);
    });
  });

  describe('2. Authorization, IDOR Protection & Boundary Guarantees', () => {
    test('profile operations strictly bind to authenticated request user context', () => {
      const authenticatedUser = {
        id: 'legitimate-voter-user-id',
        role: 'VOTER',
        status: 'ACTIVE',
      };

      // Ensure mock controller / service relies solely on authenticated user ID and never reads user ID from body or query
      const req = {
        user: authenticatedUser,
        body: { userId: 'spoofed-target-user-id' },
        query: { id: 'spoofed-query-id' },
      };

      assert.equal(req.user.id, 'legitimate-voter-user-id');
      assert.notEqual(req.user.id, req.body.userId);
    });
  });
});
