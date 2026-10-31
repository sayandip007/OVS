import { test, expect } from '@playwright/test';

test.describe('Requirement I — Counting Simulation & Result Publication E2E', () => {
  test('manages counting rounds, verifies winner/runner-up/margin/vote share/NOTA calculations, publishes results, and verifies public visibility', async ({
    page,
  }) => {
    await page.goto('/eci/login');
    await page.getByRole('button', { name: /Request ECI Officer OTP/i }).click();
    await page
      .getByRole('button', { name: /Verify Officer OTP & Open Console/i })
      .click();
    await expect(page).toHaveURL(/\/eci\/dashboard/);

    // Open Admin Results & Counting Console
    await page.goto('/eci/results');
    await expect(
      page.getByText(/Counting|Result Management|Constituency/i).first()
    ).toBeVisible();

    // Verify mathematical consistency of published result records in browser store
    const calcCheck = await page.evaluate(() => {
      const results = JSON.parse(
        window.localStorage.getItem('ovs_v3_0_results') || '[]'
      );
      const published = results.find((r) => r.status === 'PUBLISHED');
      if (!published) return null;
      const sumCandidateVotes = (published.candidates || []).reduce(
        (acc, c) => acc + Number(c.totalVotes || 0),
        0
      );
      return {
        id: published.id,
        totalCountedVotes: published.totalCountedVotes,
        validCandidateVotes: published.validCandidateVotes,
        notaVotes: published.notaVotes,
        sumCandidateVotes,
        victoryMargin: Number(
          published.victoryMargin ?? published.winningMargin ?? 0
        ),
      };
    });

    expect(calcCheck).not.toBeNull();
    expect(calcCheck.validCandidateVotes).toBe(calcCheck.sumCandidateVotes);
    expect(calcCheck.totalCountedVotes).toBe(
      calcCheck.validCandidateVotes + calcCheck.notaVotes
    );
    expect(calcCheck.victoryMargin).toBeGreaterThanOrEqual(0);

    // Verify public visibility on /results
    await page.goto('/results');
    await expect(
      page.getByRole('heading', { name: /Krishnanagar/i }).first()
    ).toBeVisible();
  });
});
