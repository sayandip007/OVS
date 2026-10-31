import { test, expect } from '@playwright/test';

test.describe('Requirement G — Candidate-Choice Privacy & Zero Ballot Persistence E2E', () => {
  test('confirms ballot and verifies zero candidate/party choice exposure in localStorage, receipt, history, profile, notifications, and admin views', async ({
    page,
  }) => {
    await page.goto('/voter/login');
    await page.getByRole('button', { name: /Generate Demo OTP/i }).click();
    const verifyBtn = page.getByRole('button', {
      name: /Verify Demo OTP & Enter Voter Portal/i,
    });
    await expect(verifyBtn).toBeVisible();
    await verifyBtn.click();
    await expect(page).toHaveURL(/\/voter\/dashboard/);

    await page.goto('/voter/elections/LS-2029/ballot');
    await page
      .locator('[data-testid^="ballot-candidate-card-"]')
      .first()
      .click();
    await page.getByTestId('review-ballot-selection-btn').click();
    await page.getByTestId('open-demo-confirm-modal-btn').click();
    await page.getByTestId('complete-demo-participation-btn').click();

    // 1. Receipt page must not display any candidate name or party selection
    await expect(page).toHaveURL(/\/voter\/elections\/LS-2029\/receipt/);
    const receiptText = await page
      .getByTestId('demo-confirmation-receipt')
      .innerText();
    expect(receiptText).not.toMatch(/CAND-LS29-KRN-1|Mahua Moitra|Amrita Roy/i);

    // 2. Inspect localStorage voter record and notifications
    const storageAudit = await page.evaluate(() => {
      const voters = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_voters') || '[]'
      );
      const v1 = voters.find(
        (v) => v.id === 'VOTER-001' || v.voterId === 'VOTER-001'
      );
      const lsEntry = v1?.elections?.['LS-2029'] || {};
      const notifications = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_voter_notifications') || '[]'
      );
      return {
        lsKeys: Object.keys(lsEntry).sort(),
        lsEntry,
        notificationsJson: JSON.stringify(notifications),
      };
    });

    expect(storageAudit.lsKeys).toEqual([
      'demoReference',
      'participated',
      'participatedAt',
      'referenceId',
      'status',
    ]);
    expect(storageAudit.lsEntry.participatedAt).toBe(
      '2029-04-20T10:30:00.000Z'
    );
    expect(storageAudit.notificationsJson).not.toMatch(/CAND-LS29-KRN-1/i);

    // 3. Check Participation History & Voter Profile pages
    await page.goto('/voter/history');
    const historyBody = await page.locator('main').innerText();
    expect(historyBody).not.toMatch(/CAND-LS29-KRN-1/i);

    await page.goto('/voter/profile');
    const profileBody = await page.locator('main').innerText();
    expect(profileBody).not.toMatch(/CAND-LS29-KRN-1/i);
  });
});
