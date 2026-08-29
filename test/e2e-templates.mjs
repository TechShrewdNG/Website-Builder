/**
 * Browser check for the dashboard's starter-template picker.
 *
 * The picker fetches a template archive from /templates/*.zip and runs it
 * through the same import pipeline as an uploaded .zip, so this covers the
 * bits that only exist end to end: that the static assets are actually served
 * by the deployment, that a click gets all the way to a populated editor, and
 * that the template's own stylesheet and images survive the trip.
 *
 * Usage: node test/e2e-templates.mjs [baseUrl]
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
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
page.on('pageerror', (error) => console.log(`  [page error] ${error.message}`));

try {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  const cards = page.locator('button[title^="Start from"]');
  const cardCount = await cards.count();
  check('the template gallery renders', cardCount > 0, `${cardCount} cards`);

  // Thumbnails are lazy — scroll them through the viewport before asserting,
  // or this measures load order rather than whether the assets exist.
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 300) {
    await page.evaluate((value) => window.scrollTo(0, value), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);

  const broken = await page.evaluate(
    () =>
      [...document.querySelectorAll('img[src^="/templates/"]')].filter(
        (img) => !img.complete || img.naturalWidth === 0,
      ).length,
  );
  check('every template thumbnail loads', broken === 0, `${broken} broken`);

  // --- pick one and create from it ---
  await page.evaluate(() => window.scrollTo(0, 0));
  const first = cards.first();
  const label = (await first.getAttribute('title')) ?? '';
  const templateName = label.replace('Start from ', '');
  await first.click();
  await page.waitForTimeout(4000);

  const summary = await page.locator('text=/Read/').first().textContent().catch(() => null);
  check('the template parses into a staged bundle', Boolean(summary), summary?.replace(/\s+/g, ' ').trim());

  const nameValue = await page.inputValue('#project-name');
  check('the site name is prefilled from the template', nameValue === templateName, nameValue);

  check(
    'the picked card is marked selected',
    (await first.getAttribute('aria-pressed')) === 'true',
  );

  await page.click('button:has-text("Create") ');
  await page.waitForURL('**/editor/**', { timeout: 60000 });
  const projectId = page.url().split('/editor/')[1].split(/[/?#]/)[0];
  check('creating from a template reaches the editor', true);

  const frame = page.frameLocator('iframe[title="Page canvas"]');
  await frame.locator('[data-ws="root"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);

  const headingText = await frame.locator('h1').first().textContent().catch(() => null);
  check('the template content is on the canvas', Boolean(headingText?.trim()), headingText?.slice(0, 40) ?? '');

  // A styled button proves the template's own stylesheet was merged, not just
  // that the markup arrived.
  const styled = await frame
    .locator('.btn')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)
    .catch(() => null);
  check('the template stylesheet is applied', Boolean(styled && styled !== 'rgba(0, 0, 0, 0)'), styled ?? '');

  const imgSrc = await frame.locator('img').first().getAttribute('src').catch(() => null);
  check('the template images resolved to data URLs', Boolean(imgSrc?.startsWith('data:')), imgSrc?.slice(0, 26));

  const projectRes = await page.request.get(`${BASE}/api/projects/${projectId}`);
  const projectBody = await projectRes.json().catch(() => ({}));
  const pageCount = projectBody.project?.pages?.length ?? 0;
  check('every page in the template was created', pageCount > 1, `${pageCount} pages`);

  // Nothing should have been left as an unresolved placeholder.
  const leftover = JSON.stringify(projectBody.project?.pages ?? []).match(/asset-pending:\/\//g);
  check('no unresolved image placeholders remain', !leftover, `${leftover?.length ?? 0} left`);

  // --- publish, then walk the site the way a visitor would ---
  const publishRes = await page.request.post(`${BASE}/api/projects/${projectId}/publish`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ published: true }),
  });
  const publishBody = await publishRes.json().catch(() => ({}));
  check('the site publishes', publishRes.ok(), publishBody.url ?? '');

  const slug = projectBody.project.slug;
  let unreachable = 0;
  for (const p of projectBody.project.pages) {
    const res = await page.request.get(`${BASE}/s/${slug}${p.path === '/' ? '' : p.path}`);
    if (!res.ok()) unreachable += 1;
  }
  check('every published page is reachable', unreachable === 0, `${unreachable} unreachable`);

  // The regression that made a multi-page site look like it only published its
  // home page: pages were live, but every link between them pointed somewhere
  // that 404s. Follow the real links rather than trusting the routes.
  const home = await (await page.request.get(`${BASE}/s/${slug}`)).text();
  const internal = [...home.matchAll(/href="(\/[^"]*)"/g)]
    .map((m) => m[1])
    .filter((href) => !href.startsWith('//'));
  const offSite = internal.filter((href) => !href.startsWith(`/s/${slug}`));
  check('links between pages stay inside the published site', offSite.length === 0, offSite.join(', '));

  let brokenLinks = 0;
  for (const href of [...new Set(internal)]) {
    const res = await page.request.get(`${BASE}${href}`);
    if (!res.ok()) brokenLinks += 1;
  }
  check('every link on the published home page resolves', brokenLinks === 0, `${brokenLinks} broken`);
} catch (error) {
  check('run completed without an exception', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
