/**
 * Browser check for the import path: an existing HTML template must come in,
 * still look like itself, stay editable, and export back out intact.
 *
 * Usage: node test/e2e-import.mjs <template.html> [baseUrl]
 */

import { existsSync } from 'node:fs';

import { chromium } from 'playwright';

const TEMPLATE = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'supersecret1';

if (!TEMPLATE) {
  console.error('usage: node test/e2e-import.mjs <template.html> [baseUrl]');
  process.exit(2);
}

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed });
  console.log(`${passed ? 'ok  ' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage();
page.on('pageerror', (error) => console.log(`  [page error] ${error.message}`));

try {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // ---- import ----
  await page.setInputFiles('input[type="file"]', TEMPLATE);
  await page.waitForTimeout(800);

  const summary = await page.locator('text=/Parsed/').textContent();
  check('the file is parsed and summarised before committing', Boolean(summary), summary?.trim());

  await page.fill('#project-name', `Imported ${Date.now()}`);
  await page.click('button:has-text("Create from import")');
  await page.waitForURL('**/editor/**', { timeout: 20000 });

  const frame = page.frameLocator('iframe[title="Page canvas"]');
  await frame.locator('[data-ws="root"]').waitFor({ timeout: 15000 });
  check('the imported page opens in the editor', true);

  // ---- fidelity: the template's own CSS still applies ----
  const heroBg = await frame
    .locator('.hero')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  check('the template stylesheet still styles the page', heroBg === 'rgb(16, 42, 67)', heroBg);

  const headingSize = await frame
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  check('class-based typography survives import', headingSize === '56px', headingSize);

  const btnRadius = await frame
    .locator('.btn')
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius);
  check('a text-only anchor keeps its classes and styling', btnRadius === '999px', btnRadius);

  const cardCount = await frame.locator('.card').count();
  check('nested structure is preserved', cardCount === 2, `${cardCount} cards`);

  // ---- the imported page is genuinely editable ----
  await frame.locator('h1').first().click();
  await page.locator('aside:last-of-type textarea').first().fill('Edited after import');
  await page.waitForTimeout(500);
  const edited = await frame.locator('h1').first().textContent();
  check('imported elements are editable', edited === 'Edited after import', edited ?? '');

  await page.locator('aside:last-of-type button:has-text("style")').click();
  await page.locator('aside:last-of-type').getByLabel('Size', { exact: true }).first().fill('30px');
  await page.waitForTimeout(500);
  const overridden = await frame
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  // The generated attribute selector must beat the template's class rule
  // without needing !important.
  check('an edit overrides the template stylesheet', overridden === '30px', overridden);

  // ---- export still contains the template CSS ----
  const url = page.url();
  const projectId = url.split('/editor/')[1].split(/[/?#]/)[0];
  const response = await page.request.get(`${BASE}/api/projects/${projectId}/export`);
  const size = (await response.body()).length;
  check('the project exports as a zip', response.ok() && size > 0, `${size} bytes`);
} catch (error) {
  check('run completed without an exception', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
