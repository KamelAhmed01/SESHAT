import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Jezero baseline survives an event, approval, a reload and return', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dev/');
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
  await page.getByRole('combobox', {name: 'Input channel'}).click();
  await page.getByRole('option', {name: 'Simulated mission instrument'}).click();
  await page.getByRole('combobox', {name: 'Event category'}).click();
  await page.getByRole('option', {name: 'Destination inaccessible'}).click();
  const deferred = (await page.getByRole('combobox', {name: 'Upcoming stop'}).textContent())?.trim();
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
  await page.goto('/dev/');
  await page.getByRole('radio', {name: 'Single', exact: true}).click();
  await page.getByRole('button', {name: 'Add Swift Run · Skinner Ridge'}).click();
  await page.getByText('Route options', {exact:true}).click();
  await expect(page.getByRole('button', {name: 'Show lower-slope option'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

test('QoL preset, Frontier overlay, single-mode trim, and Comms Delay triage sync packet work end-to-end', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/dev/');
  await page.getByRole('button', {name: 'Load all sites'}).click();
  await expect(page.locator('button[aria-label^="Remove "]')).toHaveCount(3);

  // Switch to Single mode triggers one-click top-priority trim helper
  await page.getByRole('radio', {name: 'Single', exact: true}).click();
  await expect(page.getByRole('button', {name: /only & switch to Single/})).toBeVisible();
  await page.getByRole('button', {name: /only & switch to Single/}).click();
  await expect(page.locator('button[aria-label^="Remove "]')).toHaveCount(1);

  // Toggle live Frontier overlay from panel strip and verify legend updates
  await expect(page.getByLabel('Live safe-return frontier')).toContainText('km² full-science');
  await page.getByRole('button', {name: 'Show on map'}).click();
  await expect(page.getByRole('region', {name: 'Map layer legend and elevation guide'})).toContainText('Point-of-No-Return Frontier (0.8×)');

  await page.getByRole('button', {name: 'Approve & lock baseline plan'}).click();
  await page.getByRole('button', {name: 'Start traverse'}).click();

  await page.getByText('Record an event', {exact:true}).click();
  await page.getByRole('combobox', {name: 'Event category'}).click();
  await page.getByRole('option', {name: 'Mission delay'}).click();
  await page.getByRole('button', {name: 'Record event & recalculate'}).click();

  await expect(page.getByText('Onboard crew triage · Earth delay bypassed')).toBeVisible();
  await page.getByRole('button', {name: 'Approve revision & continue'}).click();

  const [archiveDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', {name: 'Download JSON'}).click(),
  ]);
  const archive = JSON.parse(await readFile((await archiveDownload.path())!, 'utf8'));
  expect(archive.earthSyncPacket.schema).toBe('seshat-earth-sync-v1');
  expect(archive.earthSyncPacket.frontierSnapshot.current.fullScienceKm2).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
