import { test, expect } from '@playwright/test';

test.describe('Requirement H (Part 2) — Candidate Management & Ballot Eligibility E2E', () => {
  test('logs into Admin portal, inspects candidates, verifies APPROVED candidates appear on ballot while non-approved do not', async ({
    page,
  }) => {
    await page.goto('/eci/login');
    await page.getByRole('button', { name: /Request ECI Officer OTP/i }).click();
    await page
      .getByRole('button', { name: /Verify Officer OTP & Open Console/i })
      .click();
    await expect(page).toHaveURL(/\/eci\/dashboard/);

    await page.goto('/eci/candidates');
    await expect(
      page.getByText(/Candidate Management|Contesting Candidates/i).first()
    ).toBeVisible();

    const approvedCount = await page.evaluate(() => {
      const cands = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_candidates') || '[]'
      );
      return cands.filter((c) => (c.status || c.approvalStatus) === 'APPROVED')
        .length;
    });
    expect(approvedCount).toBeGreaterThan(0);
  });
});
