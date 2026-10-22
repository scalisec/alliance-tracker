// Click-through checks of the main screens. They use whatever data is committed,
// so they look for shapes (a table, game cards, links), not specific scores.
import { test, expect } from '@playwright/test';

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  // Every link must be https or an email link (no unsafe schemes).
  const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const h of hrefs) expect(h, `unsafe link ${h}`).toMatch(/^(https:\/\/|mailto:|#)/);
  expect(errors, 'no script errors').toEqual([]);
});

test('find a team, save it, and see it on My Teams', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Follow your team')).toBeVisible();
  await page.getByRole('button', { name: 'Find my team' }).click();
  await page.getByPlaceholder(/City, association or team name/).fill('Bulldogs Blue U10');
  const add = page.getByRole('button', { name: '+ Add' }).first();
  await add.click();
  await expect(page.getByRole('button', { name: '✓ Saved' }).first()).toBeVisible();
  await page.getByRole('button', { name: /Done/ }).click();
  const card = page.locator('.team-card').first();
  await expect(card.locator('.name')).toHaveText('Burlington Bulldogs Blue');
  await expect(card.locator('.stats .v')).toHaveCount(7);
  await expect(card.getByRole('link', { name: /MYHockey Rankings/ })).toHaveAttribute('href', /myhockeyrankings\.com\/team-info\?y=\d+&t=34792/);
  // Saved teams survive a reload (stored on the phone).
  await page.reload();
  await expect(page.locator('.team-card .name').first()).toHaveText('Burlington Bulldogs Blue');
});

test('standings table opens a team page', async ({ page }) => {
  await page.goto('./#/standings');
  const rows = page.locator('.stand tbody tr');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(3);
  const team = (await rows.first().locator('.tm span').innerText()).trim();
  await rows.first().click();
  await expect(page).toHaveURL(/#\/team\/\d+\//);
  await expect(page.locator('.team-head .name')).toHaveText(team);
  await expect(page.getByRole('tab', { name: /Results/ })).toBeVisible();
  await expect(page.locator('a.mhr-link')).toHaveAttribute('href', /^https:\/\/myhockeyrankings\.com\//);
  await expect(page.locator('a.mhr-suggest')).toHaveAttribute('href', /^mailto:benchbosslabs@gmail\.com\?subject=MYHockey/);
  await page.getByRole('tab', { name: /Upcoming/ }).click();
});

test('schedule opens a game', async ({ page }) => {
  await page.goto('./#/schedule');
  await page.getByRole('tab', { name: 'Results' }).click();
  const game = page.locator('button.game').first();
  await expect(game).toBeVisible();
  await game.click();
  await expect(page).toHaveURL(/#\/game\/\d+\/\d+/);
  await expect(page.locator('.gd-hero')).toBeVisible();
  await expect(page.getByRole('link', { name: /Alliance game page/ })).toHaveAttribute('href', /^https:\/\/alliancehockey\.com\/Groups\/\d+\/Games\/\d+\/$/);
});

test('settings show version, contact and bug report', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByText('App version', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'benchbosslabs@gmail.com' })).toHaveAttribute('href', /^mailto:benchbosslabs@gmail\.com/);
  await expect(page.getByRole('link', { name: /Report/ })).toHaveAttribute('href', /^mailto:benchbosslabs@gmail\.com\?subject=Alliance%20Tracker%3A%20bug%20report/);
});

test('switching division updates standings', async ({ page }) => {
  await page.goto('./#/standings');
  await expect(page.locator('.stand tbody tr').first()).toBeVisible();
  const before = await page.locator('.stand tbody tr .tm span').allInnerTexts();
  await page.getByLabel('Age group').selectOption('U13');
  await page.getByLabel('Level').selectOption('AAA');
  await expect(page.locator('.stand tbody tr').first()).toBeVisible();
  const after = await page.locator('.stand tbody tr .tm span').allInnerTexts();
  expect(after.length).toBeGreaterThan(3);
  expect(after.join()).not.toEqual(before.join());
});
