import { test, expect } from '@playwright/test';

test('production static export loads the unified field workbench with sticky map and theme popup', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page).toHaveTitle(/SESHAT/);
  await expect(page.getByRole('heading', { name: 'Plan a science traverse' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Planetary terrain map' })).toBeVisible();
  await expect(page.getByText('Nearby target opportunities', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Theme popup switches synchronized Astryx + workbench palette between Light and Dark.
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');

  // Verify the map viewport stays pinned when scrolling the right panel down.
  await page.getByText('Nearby target opportunities', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Shuyak · Cape Nukshak' }).click();
  await page.getByText('Itinerary and resources', { exact: true }).click();
  const beforeScroll = await page.locator('.field-map').boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const afterScroll = await page.locator('.field-map').boundingBox();
  expect(beforeScroll).not.toBeNull();
  expect(afterScroll).not.toBeNull();
  expect(Math.abs((afterScroll?.y ?? 0) - (beforeScroll?.y ?? 0))).toBeLessThanOrEqual(2);

  expect(errors).toEqual([]);
});

test('the synthetic fixture is visibly disclosed inside the unified workbench', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByText('SYNTHETIC — NOT MARS')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plan a science traverse' })).toBeVisible();
  await expect(page.locator('.cc-backdrop')).toHaveCount(0);
});

test('mobile has no document-wide horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?demo=1');
  await expect(page.getByText('SYNTHETIC — NOT MARS')).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
});
