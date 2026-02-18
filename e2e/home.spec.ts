import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('displays site title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header .site-title')).toHaveText('Learn with Paul');
  });

  test('displays author information', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.author-card')).toBeVisible();
    await expect(page.locator('.author-name')).toBeVisible();
    await expect(page.locator('.author-bio')).toBeVisible();
  });

  test('displays series list', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.series-card').first()).toBeVisible();
  });

  test('series card links to series page', async ({ page }) => {
    await page.goto('/');
    const firstSeries = page.locator('.series-card').first();
    await firstSeries.click();
    await expect(page).toHaveURL(/\/series-\d+\/$/);
  });

  test('has correct meta tags', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toContain('Learn with Paul');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });
});
