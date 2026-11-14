import { expect, test } from '@playwright/test';

test('the route map opens over both outer rings and preserves an outer stop in 3D', async ({page}) => {
  await page.goto('/');
  const relief = page.locator('.nav-map img[src$="neighborhood-orbital-geo.webp"]');
  await expect(relief).toBeVisible();
  const map = page.getByRole('application', {name: /Mars seamless terrain map viewer/});
  const [reliefBox, mapBox] = await Promise.all([relief.boundingBox(), map.boundingBox()]);
  expect(reliefBox).toBeTruthy();
  expect(mapBox).toBeTruthy();
  expect(reliefBox!.x).toBeGreaterThan(mapBox!.x);
  expect(reliefBox!.x + reliefBox!.width).toBeLessThan(mapBox!.x + mapBox!.width);
  await page.mouse.click(reliefBox!.x + reliefBox!.width * 0.85, reliefBox!.y + reliefBox!.height * 0.49);
  const inspection = page.getByRole('region', {name: 'Map point actions'});
  await expect(inspection).toContainText('Ring 2');
  await inspection.getByRole('button', {name: 'Add stop'}).click();
  await expect(page.getByRole('button', {name: 'Return to Landing Site'})).toBeVisible();
  await expect(page.getByText('Below the modeled return reserves')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Start route'})).toBeDisabled();

  await page.getByRole('button', {name: '3D terrain', exact: true}).click();
  await expect(page.getByTestId('mars-3d-view')).toContainText('5×5 Chunks (22×22 km');
  await expect(page.getByRole('button', {name: '25-Chunk Grid'})).toBeVisible();
  await page.getByRole('button', {name: 'Back to 2D', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Return to Landing Site'})).toBeVisible();
});

test('right-click can add or remove a draft stop without adding a sidebar panel', async ({page}) => {
  await page.goto('/');
  const pin = page.getByRole('button', {name: 'Inspect Shuyak · Cape Nukshak'});
  const actions = page.getByRole('region', {name: 'Map point actions'});
  await pin.click({button: 'right'});
  await expect(actions).toContainText('Shuyak');
  await expect(page.getByRole('complementary', {name: 'Route panel'}).getByRole('region', {name: 'Map point actions'})).toHaveCount(0);
  await actions.getByRole('button', {name: 'Add stop'}).click();
  await expect(actions).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Start route'})).toBeEnabled();

  await pin.focus();
  await page.keyboard.press('Shift+F10');
  await expect(actions.getByRole('button', {name: 'Remove stop'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(actions).toHaveCount(0);
  await expect(pin).toBeFocused();
  await pin.press('Enter');
  await actions.getByRole('button', {name: 'Remove stop'}).click();
  await expect(page.getByRole('button', {name: 'Start route'})).toHaveCount(0);
});

test('a map point prefills the hazard form during travel', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Add Shuyak', exact: true}).click();
  await page.getByRole('button', {name: 'Start route', exact: true}).click();
  await page.getByRole('button', {name: 'Inspect Shuyak · Cape Nukshak'}).press('Enter');
  const actions = page.getByRole('region', {name: 'Map point actions'});
  const coordinates = await actions.getByText(/^Grid /).textContent();
  const grid = coordinates?.match(/Grid (-?\d+), (-?\d+)/);
  expect(grid).toBeTruthy();
  await actions.getByRole('button', {name: 'Report hazard here'}).click();
  await expect(page.getByRole('combobox', {name: 'Event category'})).toContainText('New terrain hazard');
  await expect(page.getByRole('textbox', {name: /Event row Y/})).toHaveValue(grid![1]);
  await expect(page.getByRole('textbox', {name: /Event column X/})).toHaveValue(grid![2]);
  await expect(page.getByRole('heading', {name: 'Head to Shuyak'})).toBeVisible();
});

test('a blocked stop stays visible until the user accepts a new itinerary', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Add Shuyak', exact: true}).click();
  await page.getByRole('button', {name: 'Add Swift Run', exact: true}).click();
  await page.getByRole('button', {name: 'Start route', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Head to Shuyak'})).toBeVisible();

  await page.getByRole('button', {name: 'Report a change'}).click();
  await page.getByRole('combobox', {name: 'Event category'}).click();
  await page.getByRole('option', {name: 'Destination inaccessible'}).click();
  await page.getByRole('button', {name: /record event/i}).click();

  await expect(page.getByRole('heading', {name: 'Review your route'})).toBeVisible();
  await expect(page.getByText('Blocked stop: Shuyak')).toBeVisible();
  await page.getByRole('button', {name: 'Use this route'}).click();
  await expect(page.getByRole('heading', {name: 'Head to Swift Run'})).toBeVisible();
  await expect(page.getByText(/Skipped Shuyak/)).toBeVisible();
  await page.getByRole('button', {name: 'Dismiss update'}).click();
  await expect(page.getByRole('button', {name: 'Dismiss update'})).toHaveCount(0);
});

test('a reported hazard changes the path immediately and the previous route can be reopened', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Add Shuyak', exact: true}).click();
  await page.getByRole('button', {name: 'Add Swift Run', exact: true}).click();
  await page.getByRole('button', {name: 'Start route', exact: true}).click();
  await page.getByRole('button', {name: 'Report a change'}).click();
  await page.getByRole('combobox', {name: 'Event category'}).click();
  await page.getByRole('option', {name: 'New terrain hazard'}).click();
  // This cell is on the published Jezero test itinerary's first leg.
  await page.getByRole('textbox', {name: /Event row Y/}).fill('111');
  await page.getByRole('textbox', {name: /Event column X/}).fill('92');
  await page.getByRole('button', {name: 'Record event & recalculate'}).click();

  await expect(page.getByRole('heading', {name: 'Head to Shuyak'})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Previous path shown'})).toContainText('Path changed');
  await page.getByRole('button', {name: 'Dismiss update'}).click();
  await page.getByRole('button', {name: 'History and export'}).click();
  await page.getByRole('button', {name: /View change 1/}).click();
  await expect(page.getByRole('status').filter({hasText:'Previous path shown'})).toBeVisible();
});
