import { test, expect } from '@playwright/test';

test.describe('Article Page', () => {
  async function navigateToArticle(page: import('@playwright/test').Page) {
    await page.goto('./');
    await page.locator('.series-card').first().click();

    const articleCards = page.locator('.article-card');
    const count = await articleCards.count();
    if (count === 0) return false;

    await articleCards.first().click();
    return true;
  }

  test('displays article content', async ({ page }) => {
    const hasArticle = await navigateToArticle(page);
    test.skip(!hasArticle, 'No articles available from Notion');

    await expect(page.locator('.article-header h1')).toBeVisible();
    await expect(page.locator('.article-content')).toBeVisible();
    await expect(page.locator('time')).toBeVisible();
  });

  test('has back link to series page', async ({ page }) => {
    const hasArticle = await navigateToArticle(page);
    test.skip(!hasArticle, 'No articles available from Notion');

    await expect(page.locator('.back-link')).toBeVisible();
    await page.locator('.back-link').click();
    await expect(page.locator('.article-list')).toBeVisible();
  });

  test('images load without errors', async ({ page }) => {
    const hasArticle = await navigateToArticle(page);
    test.skip(!hasArticle, 'No articles available from Notion');

    const images = page.locator('.article-content img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate(
        (el: HTMLImageElement) => el.naturalWidth
      );
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test('has JSON-LD structured data', async ({ page }) => {
    const hasArticle = await navigateToArticle(page);
    test.skip(!hasArticle, 'No articles available from Notion');

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeTruthy();

    const data = JSON.parse(jsonLd!);
    expect(data['@type']).toBe('BlogPosting');
    expect(data.headline).toBeTruthy();
  });

  test('responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const hasArticle = await navigateToArticle(page);
    test.skip(!hasArticle, 'No articles available from Notion');

    await expect(page.locator('.article-content')).toBeVisible();
    const content = page.locator('.article-content');
    const box = await content.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
  });
});
