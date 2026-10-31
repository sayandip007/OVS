import { test, expect } from '@playwright/test';

async function loginAsDemoVoter(page) {
  await page.goto('/voter/login');
  await page.getByRole('button', { name: /Generate Demo OTP/i }).click();
  const verifyBtn = page.getByRole('button', {
    name: /Verify Demo OTP & Enter Voter Portal/i,
  });
  await expect(verifyBtn).toBeVisible();
  await verifyBtn.click();
  await expect(page).toHaveURL(/\/voter\/dashboard/);
}

test.describe('Requirement D — Lok Sabha Ballot Workflow E2E', () => {
  test('opens eligible Lok Sabha election, selects/changes candidate, tests NOTA, confirms participation, and marks VOTED', async ({
    page,
  }) => {
    await loginAsDemoVoter(page);

    // Open Lok Sabha 2029 ballot
    await page.goto('/voter/elections/LS-2029/ballot');
    await expect(page.getByTestId('lok-sabha-ballot-page')).toBeVisible();

    // Select a candidate card, then change selection to NOTA
    const firstCandidateCard = page
      .locator('[data-testid^="ballot-candidate-card-"]')
      .first();
    await firstCandidateCard.click();

    // Change selection to NOTA
    const notaCard = page.getByTestId('ballot-nota-card');
    await notaCard.click();

    // Proceed to Review
    await page.getByTestId('review-ballot-selection-btn').click();
    await expect(page.getByTestId('ballot-review-screen')).toBeVisible();

    // Open confirmation dialog and confirm demo participation
    await page.getByTestId('open-demo-confirm-modal-btn').click();
    await expect(page.getByTestId('demo-confirmation-modal')).toBeVisible();
    await page.getByTestId('complete-demo-participation-btn').click();

    // Verify receipt page and VOTED status
    await expect(page).toHaveURL(/\/voter\/elections\/LS-2029\/receipt/);
    await expect(page.getByTestId('demo-confirmation-receipt')).toBeVisible();
    await expect(page.getByText(/VOTED/i).first()).toBeVisible();
  });
});
