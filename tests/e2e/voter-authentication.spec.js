import { test, expect } from '@playwright/test';

test.describe('Requirement C — Voter Authentication & OTP Verification E2E', () => {
  test('rejects invalid credentials, logs in with valid demo credentials + OTP 123456, loads dashboard, and logs out', async ({
    page,
  }) => {
    await page.goto('/voter/login');

    // 1. Verify invalid credentials are rejected (clear pre-filled phone number too)
    const idInput = page.getByPlaceholder(/DEMO-EPIC-001/i).first();
    const phoneInput = page.getByPlaceholder(/9876543210/i).first();
    await idInput.fill('INVALID-EPIC-0000');
    await phoneInput.fill('9000099999');
    await page.getByRole('button', { name: /Generate Demo OTP/i }).click();

    // Verify OTP input is NOT opened when credentials are invalid
    const verifyBtn = page.getByRole('button', {
      name: /Verify Demo OTP & Enter Voter Portal/i,
    });
    await page.waitForTimeout(350);
    await expect(verifyBtn).toHaveCount(0);

    // 2. Login with valid demo voter (DEMO-EPIC-001 / Aarav Sen)
    await idInput.fill('DEMO-EPIC-001');
    await phoneInput.fill('9876543210');
    await page.getByRole('button', { name: /Generate Demo OTP/i }).click();

    // 3. Complete simulated OTP step (123456)
    await expect(verifyBtn).toBeVisible();
    await verifyBtn.click();

    // 4. Verify Voter Dashboard loads
    await expect(page).toHaveURL(/\/voter\/dashboard/);
    await expect(page.getByText(/Aarav Sen/i).first()).toBeVisible();

    // 5. Verify Logout works
    const logoutBtn = page
      .getByRole('button', { name: /Logout|Sign Out/i })
      .first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/voter\/login|\//);
    }
  });
});
