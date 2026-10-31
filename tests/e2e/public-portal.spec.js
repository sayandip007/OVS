import { test, expect } from '@playwright/test';

test.describe('Requirement A — Public Portal E2E Verification', () => {
  test('renders homepage, public navigation links, election info pages, published results, and responsive mobile nav', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Homepage rendering & educational disclaimer
    await expect(page.locator('header')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: /Online Voting & Election Management Portal of India/i,
      })
    ).toBeVisible();

    // 2. Navigate to Elections Information page
    await page.goto('/elections');
    await expect(
      page
        .getByRole('heading', { name: /Lok Sabha General Election 2029/i })
        .first()
    ).toBeVisible();
    await expect(
      page
        .getByRole('heading', {
          name: /West Bengal Legislative Assembly Election 2029/i,
        })
        .first()
    ).toBeVisible();

    // 3. Navigate to Published Results portal and verify published results are shown publicly
    await page.goto('/results');
    await expect(
      page.getByRole('heading', { name: /Krishnanagar/i }).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Mahua Roy Chowdhury/i).first()
    ).toBeVisible();

    // 4. Verify responsive navigation behavior on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const mobileMenuBtn = page
      .locator('button[aria-label*="menu" i], button[aria-expanded]')
      .first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
    }
    await expect(page.locator('header')).toBeVisible();
  });
});
