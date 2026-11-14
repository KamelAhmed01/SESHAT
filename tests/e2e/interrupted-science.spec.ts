import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('interrupted science preserves observations, survives reload, compares finish vs leave stop, and records keyboard hazard coordinates', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Plan a science traverse'})).toBeVisible();

  await expect(page.getByRole('button', {name: 'Add Shuyak · Cape Nukshak'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Add Hazeltop · Wildcat Ridge'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Add Swift Run · Skinner Ridge'})).toBeVisible();

  await page.getByRole('button', {name: 'Add Shuyak · Cape Nukshak'}).click();
  await page.getByRole('button', {name: 'Add Swift Run · Skinner Ridge'}).click();
  await expect(page.locator('.cc-baseline-gate')).toContainText('0.8× margin:');

  await page.getByRole('button', {name: 'Approve & lock baseline plan'}).click();
  await expect(page.getByRole('button', {name: 'Download JSON'})).toBeVisible();
  await page.getByRole('button', {name: 'Start traverse'}).click();
  await page.getByRole('button', {name: 'Arrive at stop'}).click();

  const stopOps = page.getByLabel('Active stop exploration');
  await expect(stopOps).toBeVisible();
  await expect(stopOps).toContainText('0 / 20 min');

  await stopOps.getByLabel('Observation note').fill('Layered sulfate lens observed');
  await stopOps.getByRole('button', {name: 'Record observation'}).click();

  await stopOps.getByRole('button', {name: 'Explore +10 min'}).click();
  await expect(stopOps).toHaveCount(0);

  const readingAlert = page.getByLabel('Incoming simulated reading');
  await expect(readingAlert).toBeVisible();

  await page.reload();
  await page.getByRole('button', {name: 'Resume saved mission'}).click();

  await expect(page.getByLabel('Incoming simulated reading')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Complete stop'})).toHaveCount(0);

  await page.getByLabel('Incoming simulated reading')
    .getByRole('button', {name: 'Record reading & evaluate impact'})
    .click();

  const reviewHeading = page.getByRole('heading', {name: 'Review the revised plan'});
  await expect(reviewHeading).toBeVisible();
  await expect(reviewHeading).toBeFocused();
  await expect(page.getByText(/Option A · Finish stop & continue/)).toBeVisible();
  await expect(page.getByText(/Option B · Leave stop now \(keep partial science\)/)).toBeVisible();

  await page.getByRole('button', {name: 'Approve: leave stop & continue'}).click();

  await page.getByText('Mission history', {exact:true}).click();
  await expect(page.getByText('departed-early · 10/20 min · 1 note(s)')).toBeVisible();
  await expect(page.getByText('Layered sulfate lens observed (exploration)')).toBeVisible();

  await page.getByText('Record an event', {exact:true}).click();
  await page.getByLabel('Event category').selectOption('NEW_TERRAIN_HAZARD');
  await page.getByLabel('Event row Y').fill('118');
  await page.getByLabel('Event column X').fill('122');
  await expect(page.getByText(/Target cell \(118, 122\)/)).toBeVisible();
  await page.getByLabel('Event category').selectOption('MISSION_DELAY');

  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', {name: 'Arrive at stop'}).click();
    const explore = page.getByRole('button', {name: /^Explore /});
    while (await explore.isEnabled()) await explore.click();
    await page.getByRole('button', {name: 'Complete stop'}).click();
  }
  await page.getByRole('button', {name: 'Return to Landing Site'}).click();
  await expect(page.getByRole('heading', {name: 'Mission complete'})).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download JSON'}).click();
  const archive = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(archive.execution.status).toBe('COMPLETED');
  expect(archive.execution.position).toEqual(archive.baseline.origin);
  expect(archive.execution.stopProgress.shuyak.exploredMinutes).toBe(10);
  expect(archive.execution.fieldObservations[0].note).toBe('Layered sulfate lens observed');
  expect(archive.execution.events).toHaveLength(1);

  expect(errors).toEqual([]);
});

test('workbench has no horizontal overflow at 1440x900, 1280x720, 390x844, and 320x640', async ({page}) => {
  const viewports = [
    {width: 1440, height: 900},
    {width: 1280, height: 720},
    {width: 390, height: 844},
    {width: 320, height: 640},
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', {name: 'Plan a science traverse'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Add Shuyak · Cape Nukshak'})).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth - overflow.clientWidth).toBeLessThanOrEqual(1);
  }
});
