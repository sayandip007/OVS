import { test, expect } from '@playwright/test';

async function loginVoter(page) {
  await page.goto('/voter/login');
  await page.getByRole('button', { name: /Generate Demo OTP/i }).click();
  const verifyBtn = page.getByRole('button', {
    name: /Verify Demo OTP & Enter Voter Portal/i,
  });
  await expect(verifyBtn).toBeVisible();
  await verifyBtn.click();
  await expect(page).toHaveURL(/\/voter\/dashboard/);
}

async function completeBallotForElection(page, electionId) {
  await page.goto(`/voter/elections/${electionId}/ballot`);
  await page
    .locator('[data-testid^="ballot-candidate-card-"]')
    .first()
    .click();
  await page.getByTestId('review-ballot-selection-btn').click();
  await page.getByTestId('open-demo-confirm-modal-btn').click();
  await page.getByTestId('complete-demo-participation-btn').click();
  await expect(page).toHaveURL(
    new RegExp(`/voter/elections/${electionId}/receipt`)
  );
}

test.describe('Requirement F — Simultaneous Elections Independence E2E', () => {
  test('completes Lok Sabha first leaving Assembly PENDING, then completes Assembly; also verifies reverse order after reset', async ({
    page,
  }) => {
    await loginVoter(page);

    // Order 1: Lok Sabha first, verify Assembly remains PENDING
    await completeBallotForElection(page, 'LS-2029');
    let voterRecord = await page.evaluate(() => {
      const voters = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_voters') || '[]'
      );
      return voters.find(
        (v) => v.id === 'VOTER-001' || v.voterId === 'VOTER-001'
      );
    });
    expect(voterRecord.elections['LS-2029'].status).toBe('VOTED');
    expect(voterRecord.elections['WB-ASSEMBLY-2029'].status).toBe('PENDING');

    // Now complete Assembly
    await completeBallotForElection(page, 'WB-ASSEMBLY-2029');
    voterRecord = await page.evaluate(() => {
      const voters = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_voters') || '[]'
      );
      return voters.find(
        (v) => v.id === 'VOTER-001' || v.voterId === 'VOTER-001'
      );
    });
    expect(voterRecord.elections['LS-2029'].status).toBe('VOTED');
    expect(voterRecord.elections['WB-ASSEMBLY-2029'].status).toBe('VOTED');

    // Order 2 (Reverse Order): Clear localStorage + sessionStorage and complete Assembly first, then Lok Sabha
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await loginVoter(page);

    await completeBallotForElection(page, 'WB-ASSEMBLY-2029');
    voterRecord = await page.evaluate(() => {
      const voters = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_voters') || '[]'
      );
      return voters.find(
        (v) => v.id === 'VOTER-001' || v.voterId === 'VOTER-001'
      );
    });
    expect(voterRecord.elections['WB-ASSEMBLY-2029'].status).toBe('VOTED');
    expect(voterRecord.elections['LS-2029'].status).toBe('PENDING');

    await completeBallotForElection(page, 'LS-2029');
    voterRecord = await page.evaluate(() => {
      const voters = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_voters') || '[]'
      );
      return voters.find(
        (v) => v.id === 'VOTER-001' || v.voterId === 'VOTER-001'
      );
    });
    expect(voterRecord.elections['WB-ASSEMBLY-2029'].status).toBe('VOTED');
    expect(voterRecord.elections['LS-2029'].status).toBe('VOTED');
  });
});
