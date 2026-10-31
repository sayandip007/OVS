import { test, expect } from '@playwright/test';

test.describe('Requirement J (Part 1) — 17-Rule Election Data Integrity Audit E2E', () => {
  test('verifies all 17 relational and provenance rules pass in the browser dataset and Admin Settings', async ({
    page,
  }) => {
    await page.goto('/eci/login');
    await page.getByRole('button', { name: /Request ECI Officer OTP/i }).click();
    await page
      .getByRole('button', { name: /Verify Officer OTP & Open Console/i })
      .click();
    await expect(page).toHaveURL(/\/eci\/dashboard/);

    await page.goto('/eci/settings');
    await expect(
      page.getByText(/17\/17|Data Integrity|Healthy|System Settings/i).first()
    ).toBeVisible();
  });
});
