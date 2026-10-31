import { test, expect } from '@playwright/test';

test.describe('Requirement E — State Assembly Ballot Workflow E2E', () => {
  test('opens eligible State Assembly election, reviews candidates, confirms participation, and marks VOTED', async ({
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

    // Open West Bengal Legislative Assembly 2029 ballot
    await page.goto('/voter/elections/WB-ASSEMBLY-2029/ballot');
    await expect(page.getByTestId('state-assembly-ballot-page')).toBeVisible();

    const firstCandidateCard = page
      .locator('[data-testid^="ballot-candidate-card-"]')
      .first();
    await firstCandidateCard.click();

    await page.getByTestId('review-ballot-selection-btn').click();
    await expect(page.getByTestId('ballot-review-screen')).toBeVisible();

    await page.getByTestId('open-demo-confirm-modal-btn').click();
    await page.getByTestId('complete-demo-participation-btn').click();

    await expect(page).toHaveURL(/\/voter\/elections\/WB-ASSEMBLY-2029\/receipt/);
    await expect(page.getByTestId('demo-confirmation-receipt')).toBeVisible();
    await expect(page.getByText(/VOTED/i).first()).toBeVisible();
  });
});
