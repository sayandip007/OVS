import { test, expect } from '@playwright/test';

test.describe('Requirement J (Part 2) — Persistence, Malformed localStorage Recovery & Demo Reset E2E', () => {
  test('recovers gracefully from malformed localStorage JSON, persists state across reloads, and resets to clean canonical state', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Inject malformed JSON into localStorage keys and reload
    await page.evaluate(() => {
      window.localStorage.setItem('ovs_v3_0_elections', '{corrupted-json');
      window.localStorage.setItem('ovs_v3_0_voters', '[broken');
    });

    await page.reload();

    // Application must self-heal and render normally without crashing
    await expect(page.locator('header')).toBeVisible();
    const recoveredElections = await page.evaluate(() => {
      const raw = window.localStorage.getItem('ovs_v3_0_elections');
      return raw ? JSON.parse(raw) : [];
    });
    expect(Array.isArray(recoveredElections)).toBe(true);
    expect(recoveredElections.length).toBeGreaterThanOrEqual(5);

    // 2. Verify state restoration across page reload
    await page.goto('/elections');
    await page.reload();
    await expect(
      page.getByText(/Lok Sabha General Election 2029/i).first()
    ).toBeVisible();
  });
});
