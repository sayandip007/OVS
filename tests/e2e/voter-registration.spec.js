import { test, expect } from '@playwright/test';

test.describe('Requirement B — Voter Registration & Cascading Geography E2E', () => {
  test('selects State -> District -> Parliamentary Constituency -> Assembly Constituency, submits registration, and persists voter', async ({
    page,
  }) => {
    await page.goto('/voter/register');

    await expect(
      page.getByRole('heading', { name: /Demo Voter Registration/i })
    ).toBeVisible();

    // Step 1: Personal Information
    await page
      .getByPlaceholder(/Debashis Banerjee/i)
      .fill('Rituparna Mukhopadhyay');
    await page.locator('input[type="date"]').fill('1996-05-14');
    await page.locator('select').first().selectOption('Female');
    await page
      .getByPlaceholder(/citizen.demo@example.com/i)
      .fill('rituparna.m@example.in');
    await page.getByPlaceholder(/98XXXXXXXX/i).fill('9831199887');

    await page.getByRole('button', { name: /Continue to Step 2/i }).click();

    // Step 2: Demo Identity & Residential Address (unique non-duplicate EPIC)
    await page
      .getByPlaceholder(/DEMO-EPIC-777/i)
      .fill('WBX4455667');
    await page.getByPlaceholder(/741101/i).fill('741101');
    await page
      .getByPlaceholder(/House No, Street/i)
      .fill('14 College Street, Krishnanagar, Nadia');

    await page.getByRole('button', { name: /Continue to Step 3/i }).click();

    // Step 3: Cascading Geographical & Dual Constituency Mapping
    const selects = page.locator('select');
    await selects.nth(0).selectOption('WB');
    await selects.nth(1).selectOption('NADIA');
    await selects.nth(2).selectOption('WB-PC-KRISHNANAGAR');
    await selects.nth(3).selectOption('WB-AC-KRISHNANAGAR-UTTAR');

    await page.getByRole('button', { name: /Continue to Step 4/i }).click();

    // Step 4: Review & Confirmation
    await page.locator('input[type="checkbox"]').check();
    await page
      .getByRole('button', { name: /Submit Demo Voter Registration/i })
      .click();

    // Verify registration completion screen and localStorage persistence
    await expect(
      page.getByRole('heading', { name: /Welcome, Rituparna Mukhopadhyay!/i })
    ).toBeVisible();

    const storedVoters = await page.evaluate(() => {
      const raw = window.localStorage.getItem('ovs_v3_0_voters');
      return raw ? JSON.parse(raw) : [];
    });
    expect(
      storedVoters.some((v) => v.fullName === 'Rituparna Mukhopadhyay')
    ).toBe(true);
  });
});
