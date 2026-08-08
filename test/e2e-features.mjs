/**
 * Browser checks for the editor features that only exist in the UI:
 * global header/footer targeting, SEO fields, snapshots, the media library,
 * clipboard shortcuts and the internal link picker.
 *
 * Usage: node test/e2e-features.mjs [baseUrl]
 */

import { existsSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'supersecret1';

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
const right = () => page.locator('aside').last();

try {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });

  // ---- create from a template ----
  await page.fill('#project-name', `Features ${Date.now()}`);
  await page.click('button:has-text("Create blank site")');
  await page.waitForURL('**/editor/**', { timeout: 20000 });
  await frame().locator('[data-ws="root"]').waitFor({ timeout: 20000 });
  check('editor opens', true);

  // ---- pages panel: SEO ----
  await tab('pages').click();
  await left().locator('textarea').first().fill('A description used for search and link previews.');
  await page.waitForTimeout(1800); // let the debounced save land

  const projectId = page.url().split('/editor/')[1].split(/[/?#]/)[0];
  const api = await page.request.get(`${BASE}/api/projects/${projectId}`);
  const saved = (await api.json()).project.pages[0];
  check('page description persists', saved.description?.startsWith('A description used'), saved.description ?? '');

  // ---- global header ----
  await left().locator('button:has-text("Site header")').click();
  await page.waitForTimeout(500);
  await tab('widgets').click();
  await left().locator('button:has-text("Heading")').first().click();
  await page.waitForTimeout(1800);

  const afterHeader = await (await page.request.get(`${BASE}/api/projects/${projectId}`)).json();
  check('editing the site header saves to the project', Boolean(afterHeader.project.headerTree));

  // ---- the header now frames every page, read-only ----
  await tab('pages').click();
  await left().locator('button:has-text("Site header")').click();
  await page.waitForTimeout(300);
  await left().locator('li button').first().click(); // back to the page
  await page.waitForTimeout(700);

  const locked = await frame().locator('[data-ws-locked="true"]').count();
  check('the global header appears on the page, marked locked', locked > 0, `${locked} locked nodes`);

  const lockedDraggable = await frame().locator('[data-ws-locked="true"][draggable="true"]').count();
  check('locked global sections are not draggable', lockedDraggable === 0);

  // ---- clipboard ----
  // Must be a node the page owns: the global header's heading comes first in
  // document order and is deliberately unselectable.
  await frame().locator('[data-ws-type="heading"]:not([data-ws-locked="true"])').first().click();
  await page.waitForTimeout(300);
  check(
    'a page-owned node is selected before copying',
    (await frame().locator('[data-ws-selected="true"]').count()) === 1,
  );
  await page.waitForTimeout(300);
  const beforeCopy = await frame().locator('[data-ws]').count();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(700);
  const afterPaste = await frame().locator('[data-ws]').count();
  check('copy and paste duplicates a node', afterPaste > beforeCopy, `${beforeCopy} -> ${afterPaste}`);

  // ---- snapshots ----
  await tab('pages').click();
  await left().locator('button:has-text("Save a snapshot")').click();
  await page.waitForTimeout(1200);
  const revisionRows = await left().locator('button:has-text("Restore")').count();
  check('a snapshot appears in the history list', revisionRows > 0, `${revisionRows} snapshot(s)`);

  // ---- site panel: media library + site URL ----
  await tab('site').click();
  await page.waitForTimeout(600);
  check('media library renders', (await left().locator('text=/No uploads yet|image/').count()) > 0);

  await left().locator('input[placeholder="https://example.com"]').fill('https://features.example');
  await left().locator('h3:has-text("Project CSS")').click();
  await page.waitForTimeout(1200);
  const withUrl = await (await page.request.get(`${BASE}/api/projects/${projectId}`)).json();
  check('site URL saves on blur', withUrl.project.siteUrl === 'https://features.example', withUrl.project.siteUrl ?? '');

  // ---- internal link picker ----
  await tab('widgets').click();
  await left().locator('button:has-text("Button")').first().click();
  await page.waitForTimeout(700);
  const picker = right().locator('select[aria-label*="pick a page"]');
  check('link fields offer the site\'s own pages', (await picker.count()) > 0);
  if ((await picker.count()) > 0) {
    const options = await picker.first().locator('option').allTextContents();
    check('the page list is populated', options.length > 1, options.join(', '));
  }

  // ---- export carries the new metadata ----
  const zip = await page.request.get(`${BASE}/api/projects/${projectId}/export`);
  check('export still succeeds', zip.ok(), `${(await zip.body()).length} bytes`);
} catch (error) {
  check('run completed without an exception', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
