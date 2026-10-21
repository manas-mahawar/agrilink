import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

// Automated accessibility (axe-core, WCAG 2.1 A/AA rules) and responsive checks.
// Automated tools catch only part of accessibility problems; see docs/SECURITY.md → Manual checks.

const PUBLIC = ['/', '/marketplace', '/marketplace?view=list', '/about', '/services', '/contact', '/privacy', '/terms', '/login', '/register', '/forgot-password', '/no-such-page'];
const SIGNED_IN = ['/dashboard/farmer', '/dashboard/listings', '/dashboard/listings/new', '/dashboard/offers', '/dashboard/orders', '/dashboard/notifications', '/dashboard/profile'];

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes[0]?.target.join(' ')}`);
}

async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

test.describe('public pages', () => {
  for (const path of PUBLIC) {
    test(`axe: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axe(page)).toEqual([]);
    });
  }

  test('phone width (360 px): no sideways scrolling, menu works', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const path of PUBLIC) {
      await page.goto(path);
      expect(await noHorizontalScroll(page), path).toBe(true);
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Explore Produce' })).toBeVisible();
  });
});

test.describe('signed-in pages', () => {
  test('farmer dashboard pages pass axe and fit a phone screen', async ({ page }) => {
    const email = `a11y.${Date.now()}@example.com`;
    await page.goto('/register?role=farmer');
    await page.getByLabel('Your full name').fill('Access Check');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Access2026check');
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole('button', { name: 'Create farmer account' }).click();
    await expect(page).toHaveURL(/\/dashboard\/farmer/);
    for (const path of SIGNED_IN) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axe(page), path).toEqual([]);
    }
    await page.setViewportSize({ width: 360, height: 780 });
    for (const path of SIGNED_IN) {
      await page.goto(path);
      expect(await noHorizontalScroll(page), path).toBe(true);
    }
  });

  test('keyboard: skip link moves focus to the main content', async ({ page }) => {
    await page.goto('/marketplace');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});
