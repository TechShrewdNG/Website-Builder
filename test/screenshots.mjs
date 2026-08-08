/**
 * Captures the app's main surfaces to disk, for reviewing design changes.
 *
 * Usage: node test/screenshots.mjs <outDir> [baseUrl]
 */

import { existsSync, mkdirSync } from 'node:fs';

import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'screenshots';
const BASE = process.argv[3] ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'supersecret1';

mkdirSync(OUT, { recursive: true });

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name, { full = false } = {}) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log(`captured ${name}`);
}

await page.goto(`${BASE}/`);
await shot('01-landing', { full: true });

await page.goto(`${BASE}/register`);
await shot('02-register');

await page.goto(`${BASE}/login`);
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 20000 });
await shot('03-dashboard', { full: true });

// Open the most recent project so the editor has real content in it.
const firstEdit = page.locator('a:has-text("Edit")').first();
if ((await firstEdit.count()) > 0) {
  await firstEdit.click();
  await page.waitForURL('**/editor/**', { timeout: 20000 });
  await page.frameLocator('iframe[title="Page canvas"]').locator('[data-ws="root"]').waitFor({ timeout: 20000 });
  await shot('04-editor');

  // With something selected, so the inspector is populated.
  await page.frameLocator('iframe[title="Page canvas"]').locator('h1').first().click();
  await shot('05-editor-selected');

  await page.locator('aside:last-of-type button:has-text("style")').click();
  await shot('06-editor-styles');

  await page.locator('aside:first-of-type button:has-text("layers")').click();
  await shot('07-editor-layers');
}

// Mobile, since that's how the app actually got tested.
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(`${BASE}/register`);
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: `${OUT}/08-register-mobile.png` });
console.log('captured 08-register-mobile');

await browser.close();
console.log(`\nScreenshots written to ${OUT}/`);
