import { expect, test } from '@playwright/test';

test('Jezero baseline survives an event, approval, a reload and return', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Plan a science traverse'})).toBeVisible();
  await page.getByRole('button', {name: 'Add Shuyak · Cape Nukshak'}).click();
  await page.getByRole('button', {name: 'Add Hazeltop · Wildcat Ridge'}).click();
  await page.getByRole('button', {name: 'Add Swift Run · Skinner Ridge'}).click();
  await page.getByText('Layers', {exact:true}).click();
  await page.getByRole('button', {name: 'Orbital', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Orbital', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Approve & lock baseline plan'}).click();
  await expect(page.getByRole('button', {name: 'Download JSON'})).toBeVisible();
  await page.getByRole('button', {name: 'Start traverse'}).click();
  await page.getByRole('button', {name: 'Move along active leg'}).click();
  await page.getByRole('button', {name: 'Arrive at stop'}).click();
  await page.getByRole('button', {name: 'Explore +10 min'}).click();
  const reading = page.getByRole('button', {name: 'Dismiss reading'});
  if (await reading.isVisible()) await reading.click();
  await page.getByRole('button', {name: 'Explore +10 min'}).click();
  if (await reading.isVisible()) await reading.click();
  await page.getByRole('button', {name: 'Complete stop'}).click();
  await page.getByText('Mission history', {exact:true}).click();
  const completedStop = await page.getByRole('listitem').filter({hasText: /^✓/}).textContent();
  await page.getByText('Record an event', {exact:true}).click();
  await page.getByLabel('Input channel').selectOption('INSTRUMENT_INTEGRATION');
  await page.getByLabel('Event category').selectOption('DESTINATION_ACCESSIBILITY_CHANGE');
  const deferred = await page.getByLabel('Upcoming stop').locator('option').first().textContent();
  await page.getByRole('button', {name: 'Record event & recalculate'}).click();
  await expect(page.getByRole('heading', {name: 'Review the revised plan'})).toBeVisible();
  await expect(page.getByText(`Deferred: ${deferred}.`)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Arrive at stop'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Hold position'}).click();
  await page.getByRole('button', {name: 'Resume review'}).click();
  await page.getByRole('button', {name: 'Approve revision & continue'}).click();
  await page.reload();
  await page.getByRole('button', {name: 'Resume saved mission'}).click();
  await page.getByText('Mission history', {exact:true}).click();
  await expect(page.getByText(completedStop!, {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Arrive at stop'}).click();
  await page.getByRole('button', {name: 'Explore +10 min'}).click();
  await page.getByRole('button', {name: 'Explore +10 min'}).click();
  await page.getByRole('button', {name: 'Complete stop'}).click();
  await page.getByRole('button', {name: 'Return to Landing Site'}).click();
  await expect(page.getByRole('heading', {name: 'Mission complete'})).toBeVisible();
  const [archive] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', {name: 'Download JSON'}).click(),
  ]);
  expect(archive.suggestedFilename()).toBe('seshat-mission-archive.json');
  expect(errors).toEqual([]);
});

test('real planning view fits the mobile viewport', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await page.getByRole('button', {name: 'Single', exact: true}).click();
  await page.getByRole('button', {name: 'Add Swift Run · Skinner Ridge'}).click();
  await page.getByText('Route options', {exact:true}).click();
  await expect(page.getByRole('button', {name: 'Show lower-slope option'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
