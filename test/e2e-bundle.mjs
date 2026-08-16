/**
 * Browser check for the .zip bundle import path: a multi-page template with a
 * linked stylesheet and a local image should become a multi-page project with
 * the stylesheet merged and the image resolved — the whole reason bundle
 * import exists over single-file import.
 *
 * Usage: node test/e2e-bundle.mjs <bundle.zip> [baseUrl]
 */

import { existsSync } from 'node:fs';

import { chromium } from 'playwright';

const ZIP = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'supersecret1';

if (!ZIP) {
  console.error('usage: node test/e2e-bundle.mjs <bundle.zip> [baseUrl]');
  process.exit(2);
}

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed });
  console.log(`${passed ? 'ok  ' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => console.log(`  [page error] ${error.message}`));

const frame = () => page.frameLocator('iframe[title="Page canvas"]');
const left = () => page.locator('aside').first();
const tab = (name) => left().locator('nav button', { hasText: new RegExp(`^${name}$`, 'i') });

try {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // ---- import the .zip ----
  const zipButton = page.locator('button:has-text(".zip")');
  check('a .zip import option exists', (await zipButton.count()) > 0);

  // The button just calls .click() on a hidden <input type="file"> ref rather
  // than opening a native picker Playwright can intercept as a filechooser,
  // so the hidden input is targeted directly — same approach the single-file
  // import test uses against input[type="file"].
  await page.setInputFiles('input[accept=".zip,application/zip"]', ZIP);
  await page.waitForTimeout(1500);

  const summary = await page.locator('text=/Read/').first().textContent().catch(() => null);
  check('the bundle is parsed and summarised before committing', Boolean(summary), summary ?? '');

  const twoPages = await page.locator('text=/2 pages/').count();
  check('both html files in the zip are detected as pages', twoPages > 0);

  await page.fill('#project-name', `Bundle ${Date.now()}`);
  await page.click('button:has-text("Create") ');
  await page.waitForURL('**/editor/**', { timeout: 20000 });
  await frame().locator('[data-ws="root"]').waitFor({ timeout: 20000 });
  check('the bundle opens in the editor', true);

  const projectId = page.url().split('/editor/')[1].split(/[/?#]/)[0];

  // ---- the linked stylesheet was merged, not left dangling ----
  const titleColor = await frame()
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  check('the linked stylesheet styles the imported page', titleColor === 'rgb(171, 18, 205)', titleColor);

  // ---- the local image was inlined, not left as a 404 path ----
  const imgSrc = await frame().locator('img').first().getAttribute('src').catch(() => null);
  check('the local image was resolved to a data URL', Boolean(imgSrc?.startsWith('data:')), imgSrc?.slice(0, 30));

  // ---- the second page exists and shares the same stylesheet ----
  await tab('pages').click();
  await page.waitForTimeout(400);
  const pageLinks = await left().locator('nav button, li button, button').allTextContents();
  const hasAbout = pageLinks.some((text) => /about/i.test(text));
  check('the about page from the bundle exists as a real page', hasAbout, pageLinks.join(', '));

  if (hasAbout) {
    await left().locator('button', { hasText: /about/i }).first().click();
    await page.waitForTimeout(700);
    const aboutColor = await frame()
      .locator('h1')
      .first()
      .evaluate((el) => getComputedStyle(el).color)
      .catch(() => null);
    check('the second page also gets the merged stylesheet', aboutColor === 'rgb(171, 18, 205)', aboutColor);
  }

  // ---- export still works with the multi-page, multi-asset project ----
  const zip = await page.request.get(`${BASE}/api/projects/${projectId}/export`);
  check('the multi-page bundle exports as a zip', zip.ok(), `${(await zip.body()).length} bytes`);
} catch (error) {
  check('run completed without an exception', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
