import { AxeBuilder } from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/** A seeded string per route, so the scan runs against loaded content. */
const routes = [
  { path: '/', name: 'backlog', ready: 'Fix checkout crash on Safari' },
  { path: '/board', name: 'board', ready: 'Fix checkout crash on Safari' },
  { path: '/matrix', name: 'matrix', ready: 'Impact / Effort' },
  { path: '/projects', name: 'projects', ready: 'Website relaunch' },
  { path: '/settings', name: 'settings', ready: 'Bucket thresholds' },
] as const;

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

for (const route of routes) {
  test(`a11y: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByText(route.ready, { exact: false }).first()).toBeVisible();

    const { violations } = await scan(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}

test('keyboard: skip link jumps to main content', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Backlog', exact: true })).toBeVisible();

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('keyboard: command palette opens and closes', async ({ page }) => {
  await page.goto('/');
  // Wait for the shell to mount so its window keydown listener is attached.
  await expect(page.getByText('Fix checkout crash on Safari').first()).toBeVisible();

  await page.keyboard.press('Control+k');
  const search = page.getByPlaceholder('Search commands...');
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
});

test('keyboard: quick-add modal opens on n and closes on escape', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Fix checkout crash on Safari').first()).toBeVisible();

  await page.keyboard.press('n');
  const heading = page.getByRole('heading', { name: 'New task', exact: true });
  await expect(heading).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(heading).toBeHidden();
});

test('keyboard: task drawer closes on escape', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Fix checkout crash on Safari').first().click();
  const heading = page.getByRole('heading', { name: 'Task', exact: true });
  await expect(heading).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(heading).toBeHidden();
});

test('account menu opens from the header', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Ada Admin/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
});
