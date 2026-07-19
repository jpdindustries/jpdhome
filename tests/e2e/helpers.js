import { expect } from '@playwright/test';

export async function waitForScene(page, expectedStatus = 'ready') {
  await expect(page.locator('html')).toHaveAttribute('data-scene-status', expectedStatus);
}

export function isChromiumDesktop(projectName) {
  return projectName === 'chromium-desktop';
}

export async function seedScene(page, hooks = {}) {
  await page.addInitScript((testHooks) => {
    let seed = 0x5f3759df;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    window.__JPD_TEST_HOOKS__ = testHooks;
  }, hooks);
}
