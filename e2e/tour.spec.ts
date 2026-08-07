import { fileURLToPath } from 'node:url';

import { test, expect, type Page, type TestInfo } from '@playwright/test';

/**
 * A guided tour of every route at two viewports, writing full-page screenshots
 * for visual review. `ready` is a piece of seeded content that proves the
 * route's data has loaded before the shutter fires.
 */
const routes = [
  { path: '/', name: 'backlog', heading: 'Tasks', ready: 'Fix checkout crash on Safari' },
  // The board groups tasks into summary columns instead of listing them, so a
  // column heading is what proves its query settled.
  { path: '/board', name: 'board', heading: 'Board', ready: 'In progress' },
  { path: '/matrix', name: 'matrix', heading: 'Matrix', ready: 'Impact / Effort' },
  { path: '/projects', name: 'projects', heading: 'Projects', ready: 'Website relaunch' },
  { path: '/settings', name: 'settings', heading: 'Settings', ready: 'Bucket thresholds' },
] as const;

function screenshotPath(testInfo: TestInfo, name: string): string {
  return fileURLToPath(new URL(`screenshots/${testInfo.project.name}/${name}.png`, import.meta.url));
}

async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  // Wait for web fonts so text metrics are stable rather than mid-swap.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: screenshotPath(testInfo, name), fullPage: true });
}

async function open(page: Page, route: (typeof routes)[number]): Promise<void> {
  await page.goto(route.path);
  await expect(page.getByRole('heading', { name: route.heading, exact: true }).first()).toBeVisible();
  await expect(page.getByText(route.ready, { exact: false }).first()).toBeVisible();
}

for (const route of routes) {
  test(`tour: ${route.name}`, async ({ page }, testInfo) => {
    await open(page, route);
    await shoot(page, testInfo, route.name);
  });
}

test.describe('signed out', () => {
  // The login screen lives outside the authenticated shell.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('tour: login', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await shoot(page, testInfo, 'login');
  });
});

test('tour: overlays', async ({ page }, testInfo) => {
  await open(page, routes[0]);

  await page.getByRole('button', { name: 'New task' }).first().click();
  await expect(page.getByRole('heading', { name: 'New task', exact: true })).toBeVisible();
  await shoot(page, testInfo, 'quick-add');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+k');
  await expect(page.getByPlaceholder('Search commands...')).toBeVisible();
  await shoot(page, testInfo, 'command-palette');
  await page.keyboard.press('Escape');

  // Last, because a backlog row navigates away: it opens the task's own page,
  // and editing happens in a modal from there.
  await page.getByText('Fix checkout crash on Safari').first().click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Task', exact: true })).toBeVisible();
  await shoot(page, testInfo, 'task-edit');
  await page.keyboard.press('Escape');
});
