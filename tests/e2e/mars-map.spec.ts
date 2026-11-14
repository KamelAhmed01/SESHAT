import { expect, test } from '@playwright/test';

test.describe('Seamless Mars tiled map & offline resilience', () => {
  test('renders Mars scale bar, switches geology/thermal layers, zooms out to Mars, marks outside clicks browse-only, and returns to Jezero', async ({ page }) => {
    const failedLocalAssets: string[] = [];
    page.on('response', res => {
      if (res.url().includes('/data/tiles/') && res.status() >= 400) {
        failedLocalAssets.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto('/');
    await expect(page.locator('.map-root.leaflet-container')).toBeVisible();
    await expect(page.locator('.cc-mars-scale-bar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Jezero' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fit mission' })).toBeVisible();

    // Toggle geology & thermal layers
    const geologyBtn = page.getByRole('button', { name: 'Geology' });
    const thermalBtn = page.getByRole('button', { name: 'Thermal' });
    await expect(geologyBtn).toBeVisible();
    await expect(thermalBtn).toBeVisible();
    await geologyBtn.click();
    await expect(geologyBtn).toHaveAttribute('aria-pressed', 'true');
    await geologyBtn.click();
    await thermalBtn.click();
    await expect(thermalBtn).toHaveAttribute('aria-pressed', 'true');
    await thermalBtn.click();

    // Zoom out repeatedly to reach global/regional Mars Viking view (away from the 4.4 km box)
    const zoomOut = page.locator('.leaflet-control-zoom-out');
    for (let i = 0; i < 16; i++) {
      const label = await page.locator('.cc-mars-scale-bar').innerText();
      if (/Mars regional|Mars global/.test(label)) break;
      await zoomOut.click();
      await page.waitForTimeout(220);
    }
    await expect(page.locator('.cc-mars-scale-bar')).toContainText(/Mars regional|Mars global/);

    // Click near the left side of the map viewport (far outside the 4.4 km Jezero AEQD box at regional/global scale)
    const mapBox = await page.locator('.map-root').boundingBox();
    expect(mapBox).not.toBeNull();
    if (!mapBox) return;
    await page.mouse.click(mapBox.x + 36, mapBox.y + mapBox.height * 0.55);

    await expect(page.locator('.cc-point-inspector')).toContainText('Browse only · outside modeled terrain');
    // Must not add an invalid stop when clicking browse-only territory
    await expect(page.locator('button[aria-label^="Remove "]')).toHaveCount(0);

    // Return to Jezero modeled area
    await page.getByRole('button', { name: 'Back to Jezero' }).click();
    await expect(page.locator('.cc-mars-scale-bar')).toContainText(/Western fan|Jezero regional/, { timeout: 10_000 });
    expect(failedLocalAssets).toEqual([]);
  });

  test('remains functional offline with trek.nasa.gov blocked and optional layer 404', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.route('https://trek.nasa.gov/**', route => route.abort('failed'));
    await page.route('**/data/imagery/orbital-aligned.webp', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.route('**/data/imagery/thermal-inertia-geo.webp', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.route('**/data/thermal-inertia.bin', route => route.fulfill({ status: 404, body: 'missing' }));

    await page.goto('/');
    await expect(page.locator('.map-root.leaflet-container')).toBeVisible();
    await expect(page.locator('.cc-mars-scale-bar')).toBeVisible();

    await page.getByRole('button', { name: /Add Shuyak/i }).click();
    await expect(page.locator('button[aria-label^="Remove "]')).toHaveCount(1);

    const approveBtn = page.getByRole('button', { name: 'Approve & lock baseline plan' }).first();
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();
    await expect(page.getByText('Approved route')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete next stop' }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('shows no horizontal overflow on desktop or mobile viewports', async ({ page }) => {
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp);
      await page.goto('/');
      await expect(page.locator('.map-root.leaflet-container')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(1);
    }
  });
});
