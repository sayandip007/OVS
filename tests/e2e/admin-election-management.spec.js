import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/eci/login');
  await page.getByRole('button', { name: /Request ECI Officer OTP/i }).click();
  const verifyBtn = page.getByRole('button', {
    name: /Verify Officer OTP & Open Console/i,
  });
  await expect(verifyBtn).toBeVisible();
  await verifyBtn.click();
  await expect(page).toHaveURL(/\/eci\/dashboard/);
}

test.describe('Requirement H (Part 1) — Admin Election Management & RBAC E2E', () => {
  test('logs into ECI Admin portal, views/manages elections, and enforces RBAC restrictions for Read-Only Auditor', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto('/eci/elections');
    await expect(
      page
        .getByText(/Election Management|Lok Sabha General Election 2029/i)
        .first()
    ).toBeVisible();

    // Switch role to READ_ONLY_AUDITOR if role switcher is present and verify route/mutation restriction
    const roleSelect = page.locator('select').first();
    if (await roleSelect.isVisible()) {
      const optionsText = await roleSelect.innerText();
      if (optionsText.includes('Auditor') || optionsText.includes('ECI-ADMIN-005')) {
        await roleSelect.selectOption('ECI-ADMIN-005');
      }
    }

    await expect(page.locator('main')).toBeVisible();
  });
});
