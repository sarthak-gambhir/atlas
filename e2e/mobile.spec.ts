import { test, expect, type Page } from '@playwright/test';

/**
 * Phone-width behaviour that desktop viewports can't exercise: the shell swaps
 * the sidebar for a nav Drawer, and pages must not scroll sideways. Runs only in
 * the `mobile-390` project (see playwright.config.ts) and reuses the admin
 * storage state seeded by global-setup.
 */

/** How far the document can be scrolled horizontally; should be ~0 on a phone. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test('the nav drawer opens and navigates', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true }).first()).toBeVisible();

  // The sidebar is replaced by a toggle that opens a Drawer on phones.
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.locator('.atlas-nav-drawer');
  await expect(drawer).toBeVisible();

  await drawer.getByText('Projects', { exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { name: 'Projects', exact: true }).first()).toBeVisible();
});

test('the tasks list does not scroll sideways', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page.getByText('Fix checkout crash on Safari').first()).toBeVisible();

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test('a task detail page shows its stats and subtasks without overflow', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByText('Fix checkout crash on Safari').first().click();

  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+$/);
  // The subtasks checklist renders even when empty, with its inline add field.
  await expect(page.getByText('Subtasks', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'New subtask' })).toBeVisible();

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});
