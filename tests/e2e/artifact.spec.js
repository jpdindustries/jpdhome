import { test, expect } from '@playwright/test';
import { isChromiumDesktop, waitForScene } from './helpers.js';

for (const basePath of ['/', '/jpdhome/']) {
  test(`production artifact operates at ${basePath}`, async ({ page }, testInfo) => {
    test.skip(!isChromiumDesktop(testInfo.project.name));
    const failedAssets = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${basePath}?v=base`);
    await waitForScene(page);
    await expect(page.locator('html')).toHaveAttribute('data-renderer', 'base');
    await expect(page.locator('#logo')).toBeVisible();
    expect(failedAssets).toEqual([]);
  });
}

test('manifest, icons, discovery, security, and privacy files ship in dist', async ({ request }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  const manifestResponse = await request.get('/jpdhome/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  expect((await request.get('/jpdhome/assets/icon-192.png')).ok()).toBe(true);
  expect((await request.get('/jpdhome/robots.txt')).ok()).toBe(true);
  expect((await request.get('/jpdhome/sitemap.xml')).ok()).toBe(true);
  expect((await request.get('/jpdhome/.well-known/security.txt')).ok()).toBe(true);
  expect((await request.get('/jpdhome/llms.txt')).ok()).toBe(true);
  expect((await request.get('/jpdhome/privacy.html')).ok()).toBe(true);
  expect((await request.get('/jpdhome/CNAME')).ok()).toBe(true);
});

test('custom 404 navigation remains base-aware', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  const response = await page.goto('/jpdhome/missing-page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.locator('main img')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to jpd.industries' })).toHaveAttribute('href', './');
});
