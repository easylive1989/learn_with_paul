import { test, expect } from '@playwright/test';

test.describe('Series Page', () => {
  test('displays series title and description', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.series-description')).toBeVisible();
  });

  test('displays article list', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();

    await expect(page.locator('.article-card').first()).toBeVisible();
  });

  test('article card shows title and date', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();

    const card = page.locator('.article-card').first();
    await expect(card.locator('.article-title')).toBeVisible();
    await expect(card.locator('time')).toBeVisible();
  });

  test('has back link to homepage', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();

    await page.locator('.back-link').click();
    await expect(page.locator('.series-list')).toBeVisible();
  });
});
