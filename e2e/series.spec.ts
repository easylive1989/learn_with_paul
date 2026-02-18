import { test, expect } from '@playwright/test';

test.describe('Series Page', () => {
  test('displays series title and description', async ({ page }) => {
    await page.goto('./');
    await page.locator('.series-card').first().click();

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.series-description')).toBeVisible();
  });

  test('displays article list', async ({ page }) => {
    await page.goto('./');
    await page.locator('.series-card').first().click();

    const articleCards = page.locator('.article-card');
    const count = await articleCards.count();
    test.skip(count === 0, 'No articles available from Notion');
    await expect(articleCards.first()).toBeVisible();
  });

  test('article card shows title and date', async ({ page }) => {
    await page.goto('./');
    await page.locator('.series-card').first().click();

    const articleCards = page.locator('.article-card');
    const count = await articleCards.count();
    test.skip(count === 0, 'No articles available from Notion');

    const card = articleCards.first();
    await expect(card.locator('.article-title')).toBeVisible();
    await expect(card.locator('time')).toBeVisible();
  });

  test('has back link to homepage', async ({ page }) => {
    await page.goto('./');
    await page.locator('.series-card').first().click();

    await page.locator('.back-link').click();
    await expect(page.locator('.series-list')).toBeVisible();
  });
});
