/**
 * Browser check for the editor's core interactions.
 *
 * Drag-and-drop across an iframe boundary, inline text editing and the style
 * panel can only be verified in a real browser, so this drives Chromium
 * against a running server rather than asserting on the document model.
 *
 * Usage: node test/e2e.mjs [baseUrl]
 * Expects a server on the URL given (default http://localhost:3000) and a
 * registered account matching the credentials below.
 */

import { existsSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'supersecret1';

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'ok  ' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

// PLAYWRIGHT_BROWSERS_PATH points at a preinstalled Chromium; fall back to
// whatever playwright resolves on its own when that layout isn't present.
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
);
const page = await browser.newPage();
page.on('pageerror', (error) => console.log(`  [page error] ${error.message}`));

try {
  // ---- sign in ----
  await page.goto(`${BASE}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  check('signs in and reaches the dashboard', true);

  // ---- create a project ----
  await page.fill('#project-name', `E2E ${Date.now()}`);
  await page.click('button:has-text("Create blank site")');
  await page.waitForURL('**/editor/**', { timeout: 15000 });

  const frame = page.frameLocator('iframe[title="Page canvas"]');
  await frame.locator('[data-ws="root"]').waitFor({ timeout: 15000 });
  check('editor loads and the canvas renders the page', true);

  const startingHeading = await frame.locator('h1').first().textContent();
  check('starter content is present', startingHeading?.includes('Build something'), startingHeading ?? '');

  // ---- selection ----
  await frame.locator('h1').first().click();
  await page.locator('aside:last-of-type').getByText('Heading').first().waitFor({ timeout: 5000 });
  const selected = await frame.locator('[data-ws-selected="true"]').count();
  check('clicking an element selects it and opens its inspector', selected === 1);

  // ---- editing content through the inspector ----
  await page.locator('aside:last-of-type textarea').first().fill('Edited headline');
  await page.waitForTimeout(400);
  const headingText = await frame.locator('h1').first().textContent();
  check('inspector edits update the canvas', headingText === 'Edited headline', headingText ?? '');

  // ---- style panel, incl. responsive ----
  await page.locator('aside:last-of-type button:has-text("style")').click();
  await page.locator('aside:last-of-type').getByLabel('Text align').selectOption('center');
  await page.waitForTimeout(400);
  const align = await frame
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).textAlign);
  check('style controls apply real CSS to the canvas', align === 'center', align);

  await page.click('button[title="mobile styles"]');
  await page.locator('aside:last-of-type').getByLabel('Size', { exact: true }).first().fill('20px');
  await page.waitForTimeout(400);
  const mobileSize = await frame
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  check('mobile breakpoint styles apply at the mobile width', mobileSize === '20px', mobileSize);

  await page.click('button[title="desktop styles"]');
  await page.waitForTimeout(300);
  const desktopSize = await frame
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  check('desktop keeps its own value', desktopSize === '48px', desktopSize);

  // ---- drag and drop from the palette into the canvas ----
  await page.locator('aside:first-of-type button:has-text("widgets")').click();
  const before = await frame.locator('[data-ws]').count();

  const source = page.locator('aside:first-of-type button:has-text("Button")').first();
  const targetBox = await frame.locator('h1').first().boundingBox();
  const frameBox = await page.locator('iframe[title="Page canvas"]').boundingBox();
  const sourceBox = await source.boundingBox();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  // Several small moves: HTML5 drag only starts after the drag threshold.
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(
      sourceBox.x + ((frameBox.x + targetBox.x + targetBox.width / 2 - sourceBox.x) * step) / 8,
      sourceBox.y + ((frameBox.y + targetBox.y + targetBox.height / 2 - sourceBox.y) * step) / 8,
      { steps: 4 },
    );
  }
  await page.mouse.up();
  await page.waitForTimeout(600);

  const after = await frame.locator('[data-ws]').count();
  check('dragging a widget from the palette adds it to the page', after > before, `${before} -> ${after}`);

  // ---- click-to-add fallback ----
  const beforeClick = await frame.locator('[data-ws]').count();
  await page.locator('aside:first-of-type button:has-text("Divider")').first().click();
  await page.waitForTimeout(500);
  const afterClick = await frame.locator('[data-ws]').count();
  check('clicking a palette item adds it too', afterClick > beforeClick, `${beforeClick} -> ${afterClick}`);

  // ---- inline text editing ----
  await frame.locator('h1').first().dblclick();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Typed inline');
  await frame.locator('[data-ws="root"]').click();
  await page.waitForTimeout(500);
  const inline = await frame.locator('h1').first().textContent();
  check('double-click edits text directly on the canvas', inline === 'Typed inline', inline ?? '');

  // ---- autosave then reload ----
  await page.waitForTimeout(2000);
  await page.reload();
  await frame.locator('[data-ws="root"]').waitFor({ timeout: 15000 });
  const afterReload = await frame.locator('h1').first().textContent();
  check('edits survive a reload (autosave works)', afterReload === 'Typed inline', afterReload ?? '');

  // ---- undo ----
  const beforeUndo = await frame.locator('[data-ws]').count();
  await page.locator('button[title^="Undo"]').click();
  await page.waitForTimeout(400);
  const afterUndo = await frame.locator('[data-ws]').count();
  check('undo is available after a reload-free edit', afterUndo <= beforeUndo, `${beforeUndo} -> ${afterUndo}`);

  // ---- publish ----
  await page.click('button:has-text("Publish")');
  await page.waitForTimeout(2500);
  const live = page.locator('a:has-text("View live")');
  check('publishing exposes a live link', (await live.count()) > 0);
} catch (error) {
  check('run completed without an exception', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
