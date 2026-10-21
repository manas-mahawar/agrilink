import { expect, type Page, test } from '@playwright/test';
import sharp from 'sharp';
import { FIXTURE } from './fixtures';

// One complete deal, driven through the real UI against the local Supabase stack:
// farmer lists → buyer offers → farmer counters → buyer accepts → farmer confirms →
// contacts revealed → preparing → ready → buyer completes and rates.

test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const farmer = { name: 'Harpreet Test', email: `farmer.${stamp}@example.com`, password: 'Harvest2026', phone: '9876543210' };
const buyer = { name: 'Asha Test', org: 'Test Kitchen Patiala', email: `buyer.${stamp}@example.com`, password: 'Kitchen2026', phone: '9123456780' };
let listingUrl = '';

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/');
}

async function logIn(page: Page, who: { email: string; password: string }, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(next ? new RegExp(next.replace(/[/?]/g, '\\$&')) : /\/dashboard\//);
}

test('protected pages send visitors to log in', async ({ page }) => {
  await page.goto('/dashboard/listings');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Flistings/);
  const res = await page.goto('/admin');
  // Not signed in: redirected to login (the admin area itself 404s for non-admins).
  expect(res?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login/);
});

test('registration validates input and never offers an admin role', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('radio')).toHaveCount(2);
  await page.getByRole('button', { name: /Create buyer account/ }).click();
  await expect(page.getByText('Enter your name.')).toBeVisible();
  await expect(page.getByText('Please accept the terms to continue.')).toBeVisible();
});

test('farmer registers and publishes a listing with a photo', async ({ page }) => {
  await page.goto('/register?role=farmer');
  await page.getByLabel('Your full name').fill(farmer.name);
  await page.getByLabel('Mobile number').fill(farmer.phone);
  await page.getByLabel('Email').fill(farmer.email);
  await page.getByLabel('Password', { exact: true }).fill(farmer.password);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Create farmer account' }).click();
  await expect(page).toHaveURL(/\/dashboard\/farmer/);
  await expect(page.getByRole('heading', { name: 'Your farm on AgriLink' })).toBeVisible();

  await page.getByRole('link', { name: 'New listing' }).first().click();
  await page.getByLabel('Category').selectOption('tomatoes');
  await page.getByLabel('Produce name').fill('Tomato');
  await page.getByLabel('Variety').fill('E2E Ratta');
  await page.getByLabel('Village or nearest town').selectOption('sanaur');
  await page.getByLabel(/Expected quantity/).fill('100');
  await page.getByLabel(/Minimum order/).fill('5');
  await page.getByLabel(/Maximum order/).fill('50');
  await page.getByLabel(/Asking price/).fill('1600');
  await expect(page.getByText('= ₹16 per kg')).toBeVisible();
  const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Expected harvest date').fill(inTwoWeeks);
  await page.getByRole('button', { name: 'Publish listing' }).click();
  await expect(page).toHaveURL(/\/dashboard\/listings\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByText('Listing published.')).toBeVisible();

  await page.locator('#listing-photos').setInputFiles(FIXTURE);
  await expect(page.getByText('1 photo added.').first()).toBeVisible({ timeout: 20_000 });
  await page.reload();
  const img = page.getByRole('img', { name: /Tomato · E2E Ratta — photo from the farmer/ }).first();
  await expect(img).toBeVisible();

  // The stored photo must not carry the EXIF / GPS data from the original file.
  const src = await img.getAttribute('src');
  const bytes = Buffer.from(await (await page.request.get(src!)).body());
  const meta = await sharp(bytes).metadata();
  expect(meta.format).toBe('webp');
  expect(meta.exif).toBeUndefined();
  expect(bytes.includes(Buffer.from('SECRET-OWNER'))).toBe(false);

  await page.getByRole('link', { name: 'View public page' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tomato · E2E Ratta' })).toBeVisible();
  await expect(page.getByText('Not yet verified by AgriLink.')).toBeVisible();
  await expect(page.getByText('This is your listing.')).toBeVisible();
  listingUrl = new URL(page.url()).pathname;
  // Private details never appear on public pages.
  await expect(page.locator('body')).not.toContainText(farmer.phone);
  await expect(page.locator('body')).not.toContainText(farmer.email);
  await signOut(page);
});

test('buyer finds the listing and makes an offer', async ({ page }) => {
  await page.goto('/marketplace?q=E2E%20Ratta');
  await expect(page.getByRole('heading', { name: 'Tomato · E2E Ratta' })).toBeVisible();
  await page.getByRole('link', { name: 'View Tomato · E2E Ratta' }).click();
  await page.getByRole('link', { name: 'Create a buyer account' }).click();
  await page.getByLabel('Your full name').fill(buyer.name);
  await page.getByLabel('Business name').fill(buyer.org);
  await page.getByLabel('Type of business').selectOption('restaurant');
  await page.getByLabel('Mobile number').fill(buyer.phone);
  await page.getByLabel('Email').fill(buyer.email);
  await page.getByLabel('Password', { exact: true }).fill(buyer.password);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Create buyer account' }).click();
  await expect(page).toHaveURL(listingUrl);

  // Too large an order is refused with a clear message.
  await page.getByLabel(/Quantity \(quintals\)/).fill('80');
  await page.getByLabel(/Your price/).fill('1500');
  await page.getByRole('button', { name: 'Send offer' }).click();
  await expect(page.getByText('The maximum order for this listing is 50 quintals.')).toBeVisible();

  await page.getByLabel(/Quantity \(quintals\)/).fill('20');
  await expect(page.getByText('6.3% below the asking price')).toBeVisible();
  await page.getByLabel('Message to the farmer').fill('Need sorted Grade A, 25 kg crates.');
  await page.getByRole('button', { name: 'Send offer' }).click();
  await expect(page.getByText('Offer sent. The farmer has been notified.').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Your offer')).toBeVisible();
  await expect(page.getByText(/20 quintals at ₹1,500/)).toBeVisible();
  await signOut(page);
});

test('farmer counters; buyer accepts; order is created and quantity reserved', async ({ page }) => {
  await logIn(page, farmer);
  await expect(page).toHaveURL(/\/dashboard\/farmer/);
  await expect(page.getByRole('link', { name: /Notifications, 1 unread/ })).toBeVisible();
  await page.getByRole('link', { name: /Tomato · E2E Ratta/ }).first().click();
  await expect(page.getByText('Need sorted Grade A, 25 kg crates.')).toBeVisible();
  await page.getByRole('button', { name: 'Counter' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Price/).fill('1575');
  await dialog.getByLabel('Message').fill('Can do 1,575 with crates.');
  await dialog.getByRole('button', { name: 'Send counter-offer' }).click();
  await expect(page.getByText('Counter-offer sent.').first()).toBeVisible();
  await expect(page.getByText('Waiting for the buyer to respond')).toBeVisible();
  await signOut(page);

  await logIn(page, buyer);
  await expect(page).toHaveURL(/\/dashboard\/buyer/);
  await page.getByRole('link', { name: /Tomato · E2E Ratta/ }).first().click();
  await expect(page.getByText('Countered — your turn')).toBeVisible();
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('dialog')).toContainText('20 quintals at ₹1,575/quintal = ₹31,500');
  await page.getByRole('button', { name: 'Accept and create order' }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name: /Order AGL-\d{4}-\d{5}/ })).toBeVisible();
  await expect(page.getByText('Waiting for the farmer to confirm a date.')).toBeVisible();
  await expect(page.getByText('Phone numbers are shared with both sides once the farmer confirms the order.')).toBeVisible();

  // Public listing now shows the reserved quantity as unavailable.
  await page.goto(listingUrl);
  await expect(page.getByText('80 quintals of 100 quintals')).toBeVisible();
  await signOut(page);
});

test('farmer confirms and fulfils; contacts are shared; buyer completes and rates', async ({ page }) => {
  await logIn(page, farmer, '/dashboard/orders');
  await page.getByRole('link', { name: /Tomato · E2E Ratta/ }).first().click();
  await page.getByRole('button', { name: 'Confirm order' }).click();
  const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByRole('dialog').getByLabel('Pickup or delivery date').fill(inTwoWeeks);
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm order' }).click();
  await expect(page.getByText('Order confirmed.').first()).toBeVisible();
  await expect(page.getByRole('link', { name: buyer.phone })).toBeVisible();
  await page.getByRole('button', { name: 'Start preparing' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start preparing' }).click();
  await expect(page.getByText('Marked as being prepared.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Mark ready' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark ready' }).click();
  await expect(page.getByText('Marked as ready for pickup or delivery.').first()).toBeVisible();
  // Only the buyer can complete.
  await expect(page.getByRole('button', { name: 'Confirm receipt' })).toHaveCount(0);
  await signOut(page);

  await logIn(page, buyer, '/dashboard/orders');
  await page.getByRole('link', { name: /Tomato · E2E Ratta/ }).first().click();
  await expect(page.getByRole('link', { name: farmer.phone })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm receipt' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm receipt' }).click();
  await expect(page.getByText('Order marked as completed.').first()).toBeVisible();
  await page.getByRole('radio', { name: '5 stars' }).check({ force: true });
  await page.getByLabel('Comment').fill('Firm, well sorted tomatoes.');
  await page.getByRole('button', { name: 'Submit rating' }).click();
  await expect(page.getByText('Thanks — your rating has been saved.').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('You rated this order 5 out of 5.')).toBeVisible();
});

test('notifications can be marked as read', async ({ page }) => {
  await logIn(page, buyer);
  await page.goto('/dashboard/notifications');
  await expect(page.getByText(/^\d+ unread$/)).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByText('All caught up')).toBeVisible();
  await page.reload();
  await expect(page.getByText('All caught up')).toBeVisible();
});

test('farmer profile shows the rating from the completed order', async ({ page }) => {
  await page.goto(listingUrl);
  await page.getByRole('link', { name: 'View farmer profile and other listings' }).click();
  await expect(page.getByText('Firm, well sorted tomatoes.')).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: /^1$/ })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Moderation: reports, hiding, verification, audit — and the admin area is closed to others.
// ---------------------------------------------------------------------------
const admin = { name: 'Ops Admin', org: 'AgriLink Ops', email: `admin.${stamp}@example.com`, password: 'Moderate2026' };

test('a buyer reports a listing; non-admins cannot open the admin area', async ({ page }) => {
  await logIn(page, buyer);
  await page.goto(listingUrl);
  await page.getByRole('button', { name: 'Report this listing' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('What is wrong?').selectOption('misleading');
  await dialog.getByLabel('Details').fill('Photo looks like a stock image.');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByText('Your report has been sent')).toBeVisible();
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);
  await page.goto('/');
  await signOut(page);
});

test('an administrator hides the listing, verifies the farmer and the audit log records it', async ({ page }) => {
  // Admin rights are never granted through the app: an operator grants them in SQL.
  await page.goto('/register?role=buyer');
  await page.getByLabel('Your full name').fill(admin.name);
  await page.getByLabel('Business name').fill(admin.org);
  await page.getByLabel('Email').fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Create buyer account' }).click();
  await expect(page).toHaveURL(/\/dashboard\/buyer/);
  const { pool, q, owner } = await import('../db/helpers');
  await q(owner, `insert into public.admins (user_id) select id from auth.users where email = $1`, [admin.email]);
  await pool.end();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByText('Photo looks like a stock image.')).toBeVisible();
  await page.getByRole('button', { name: 'Hide listing' }).click();
  await page.getByRole('dialog').getByLabel('Reason shown to the farmer').fill('Photos must show your own crop.');
  await page.getByRole('dialog').getByRole('button', { name: 'Hide listing' }).click();
  await expect(page.getByText('Listing hidden from the marketplace.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Resolve' }).click();
  await page.getByRole('dialog').getByLabel('Internal note').fill('Hidden until real photos are added.');
  await page.getByRole('dialog').getByRole('button', { name: 'Save outcome' }).click();
  await expect(page.getByText('Report closed.').first()).toBeVisible();

  await page.goto(`/admin/users?q=${encodeURIComponent(farmer.name)}`);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark verified' }).click();
  await expect(page.getByRole('dialog').getByText(/Record how this farmer was verified/)).toBeVisible();
  await page.getByRole('dialog').getByLabel('How was this farmer verified?').fill('Aadhaar and land record seen in person.');
  await page.getByRole('dialog').getByRole('button', { name: 'Mark verified' }).click();
  await expect(page.getByText('Farmer marked as verified.').first()).toBeVisible();

  await page.goto('/admin/audit');
  for (const action of ['listing.hide', 'report.actioned', 'farmer.verify']) await expect(page.getByRole('cell', { name: action })).toBeVisible();

  // Hidden listing is gone from the public marketplace; the farmer profile is now verified.
  const listingRes = await page.request.get(listingUrl);
  expect(listingRes.status()).toBe(404);
  await signOut(page);
});

test('the farmer is told why the listing was hidden and cannot republish it', async ({ page }) => {
  await logIn(page, farmer);
  await page.goto('/dashboard/notifications');
  await expect(page.getByText('Your listing was removed from the marketplace')).toBeVisible();
  await expect(page.getByText('Reason: Photos must show your own crop.')).toBeVisible();
  await page.goto('/dashboard/listings');
  await expect(page.getByText('Hidden by moderators')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume' })).toHaveCount(0);
  await page.goto('/dashboard/profile');
  await expect(page.getByText(/Verified on/)).toBeVisible();
});
