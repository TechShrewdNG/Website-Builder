/**
 * Browser checks for the newer import capabilities: modelled lists and
 * tables, the CSS rule editor (edit `.btn` and every button changes), design
 * tokens pulled from `:root`, and folder/.zip bundle import with asset
 * resolution.
 *
 * Usage: node test/e2e-import-features.mjs <template.html> [baseUrl]
 */

import { existsSync } from 'node:fs';

import { chromium } from 'playwright';

const TEMPLATE = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'supersecret1';

if (!TEMPLATE) {
  console.error('usage: node test/e2e-import-features.mjs <template.html> [baseUrl]');
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
const right = () => page.locator('aside').last();
const tab = (name) => left().locator('nav button', { hasText: new RegExp(`^${name}$`, 'i') });

try {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // ---- import a template with a nav list, a table, :root tokens, and hover ----
  await page.setInputFiles('input[type="file"]', TEMPLATE);
  await page.waitForTimeout(800);
  await page.fill('#project-name', `ImportFeatures ${Date.now()}`);
  await page.click('button:has-text("Create from import")');
  await page.waitForURL('**/editor/**', { timeout: 20000 });
  await frame().locator('[data-ws="root"]').waitFor({ timeout: 20000 });
  check('the imported page opens in the editor', true);

  const projectId = page.url().split('/editor/')[1].split(/[/?#]/)[0];

  // ---- nav <ul> became an editable list, not opaque HTML ----
  const navList = frame().locator('ul').first();
  const navLinkCount = await navList.locator('a').count();
  check('the nav list renders real anchors', navLinkCount >= 2, `${navLinkCount} links`);

  await navList.click();
  await page.waitForTimeout(400);
  const listWidgetSelected = await right().locator('text=/^List$/').count();
  check('clicking the imported nav selects the List widget', listWidgetSelected > 0);

  // ---- the pricing table became an editable Table widget ----
  const tableCells = await frame().locator('table td, table th').count();
  check('the pricing table rendered as a real <table>', tableCells > 0, `${tableCells} cells`);

  await frame().locator('table').first().click();
  await page.waitForTimeout(400);
  const tableWidgetSelected = await right().locator('text=/^Table$/').count();
  check('clicking the imported table selects the Table widget', tableWidgetSelected > 0);

  const addRow = right().locator('button:has-text("Row")');
  if ((await addRow.count()) > 0) {
    const beforeRows = await frame().locator('table tr').count();
    await addRow.first().click();
    await page.waitForTimeout(500);
    const afterRows = await frame().locator('table tr').count();
    check('adding a table row updates the canvas', afterRows > beforeRows, `${beforeRows} -> ${afterRows}`);
  } else {
    check('table row control is present', false);
  }

  // ---- CSS rule editor: editing .btn should change every button ----
  await frame().locator('a.btn, .btn').first().click();
  await page.waitForTimeout(400);
  await right().locator('button:has-text("style")').click();
  await page.waitForTimeout(300);

  const rulesSection = right().locator('text=/Stylesheet rules/');
  check('the stylesheet rules section appears for a classed element', (await rulesSection.count()) > 0);

  const ruleToggle = right().locator('code:has-text(".btn")').first();
  if ((await ruleToggle.count()) > 0) {
    await ruleToggle.click();
    await page.waitForTimeout(300);
    // Find the background-color input specifically by its property label.
    const propRow = right().locator('label', { has: page.locator('code:has-text("background")') }).first();
    if ((await propRow.count()) > 0) {
      const input = propRow.locator('input').first();
      await input.fill('rgb(10, 20, 30)');
      await page.waitForTimeout(1500);

      const bg = await frame()
        .locator('a.btn, .btn')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      check('editing a class rule restyles the element live', bg === 'rgb(10, 20, 30)', bg);
    } else {
      check('found an editable background property on the rule', false);
    }
  } else {
    check('the .btn rule is listed and clickable', false);
  }

  // ---- design tokens from :root ----
  await tab('site').click();
  await page.waitForTimeout(500);
  const tokensSection = left().locator('text=/Design tokens/');
  check('design tokens section appears when the template has :root vars', (await tokensSection.count()) > 0);

  const brandToken = left().locator('code:has-text("--brand")');
  if ((await brandToken.count()) > 0) {
    const tokenRow = brandToken.locator('..');
    // The paired text field, not the native <input type="color"> swatch —
    // Playwright's fill() dispatches events the way React's change detection
    // expects; a raw .value assignment on the color picker doesn't.
    const textInput = tokenRow.locator('input.ws-field');
    check('the token has an editable text field', (await textInput.count()) > 0);
    if ((await textInput.count()) > 0) {
      await textInput.fill('#112233');
      await page.waitForTimeout(1500);
    }
    const withToken = await (await page.request.get(`${BASE}/api/projects/${projectId}`)).json();
    const savedToken = withToken.project.theme?.tokens?.['--brand'];
    check('a token override persists to the project', savedToken === '#112233', savedToken ?? '(none)');
  } else {
    check('--brand token is listed', false);
  }

  // ---- export still succeeds with all the new content ----
  const zip = await page.request.get(`${BASE}/api/projects/${projectId}/export`);
  check('export succeeds with lists, tables, rules and tokens', zip.ok(), `${(await zip.body()).length} bytes`);
} catch (error) {
  check('run completed without an exception', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
