/**
 * Browser check for the folder import path (webkitdirectory), which is a
 * separate code path from .zip import — it strips the chosen folder's own
 * name from each file's relative path rather than unzipping.
 *
 * Usage: node test/e2e-bundle-folder.mjs <folder> [baseUrl]
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const FOLDER = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'supersecret1';

if (!FOLDER) {
  console.error('usage: node test/e2e-bundle-folder.mjs <folder> [baseUrl]');
  process.exit(2);
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(full);
  }
  return out;
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

try {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  const files = walk(FOLDER);
  check('the test folder has files to upload', files.length > 0, `${files.length} files`);

  // A [webkitdirectory] input takes a directory path, not a file list —
  // Playwright walks it and sets each file's webkitRelativePath itself.
  await page.setInputFiles('input[webkitdirectory]', FOLDER);
  await page.waitForTimeout(1500);

  const summary = await page.locator('text=/Read/').first().textContent().catch(() => null);
  check('the folder is parsed and summarised before committing', Boolean(summary), summary ?? '');

  await page.fill('#project-name', `Folder ${Date.now()}`);
  await page.click('button:has-text("Create") ');
  await page.waitForURL('**/editor/**', { timeout: 20000 });

  const frame = page.frameLocator('iframe[title="Page canvas"]');
  await frame.locator('[data-ws="root"]').waitFor({ timeout: 20000 });
  check('the folder import opens in the editor', true);

  const titleColor = await frame
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  check('the linked stylesheet styles the folder-imported page', titleColor === 'rgb(171, 18, 205)', titleColor);

  const imgSrc = await frame.locator('img').first().getAttribute('src').catch(() => null);
  check('the local image was resolved to a data URL', Boolean(imgSrc?.startsWith('data:')), imgSrc?.slice(0, 30));
} catch (error) {
  check('run completed without an exception', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
