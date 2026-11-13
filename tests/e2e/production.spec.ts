import {test, expect} from '@playwright/test';

test('production static export loads the evidence-gated workbench', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/SESHAT/);
  await expect(page.getByRole('heading', {name: 'Time is terrain.'})).toBeVisible();
  await expect(page.getByRole('region', {name: 'Planetary terrain map'})).toBeVisible();
  await expect(page.getByText(/not safety-certified/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('the synthetic fixture is visibly disclosed, and clock reset is deterministic', async ({page}) => {
  await page.goto('/?demo=1');
  await expect(page.getByText('SYNTHETIC — NOT MARS')).toBeVisible();
  const first = page.locator('.time-display strong');
  await expect(first).toHaveText('180');
  await page.getByRole('button', {name: 'Advance +15 min'}).click();
  await expect(first).toHaveText('165');
  await page.getByRole('button', {name: 'Reset'}).click();
  await expect(first).toHaveText('180');
});

test('mobile has no document-wide horizontal overflow', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?demo=1');
  await expect(page.getByText('SYNTHETIC — NOT MARS')).toBeVisible();
  const width = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
});
