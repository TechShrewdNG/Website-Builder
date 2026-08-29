/**
 * Renders a preview thumbnail for each template.
 *
 * These are real screenshots of the template's own home page rather than
 * hand-drawn mockups, so the picker in the dashboard cannot drift away from
 * what the template actually looks like — regenerate and the gallery is
 * correct again.
 *
 * Saved as JPEG because these are photographic-ish screenshots where PNG is
 * several times larger for no visible gain, and they ship as static assets.
 *
 * Usage: node templates/make-thumbs.mjs
 */

import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'public', 'templates');

mkdirSync(OUT, { recursive: true });

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});

// Rendered at full desktop width then halved, so the thumbnail shows the real
// desktop layout rather than the mobile breakpoint a narrow viewport would hit.
const page = await browser.newPage({
  viewport: { width: 1280, height: 940 },
  deviceScaleFactor: 0.5,
});

const templates = readdirSync(HERE)
  .filter((name) => statSync(join(HERE, name)).isDirectory() && name !== 'dist')
  .sort();

for (const name of templates) {
  const index = join(HERE, name, 'index.html');
  if (!existsSync(index)) continue;

  await page.goto(pathToFileURL(index).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const out = join(OUT, `${name}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 74 });
  console.log(`${name}.jpg  ${(statSync(out).size / 1024).toFixed(0)} KB`);
}

await browser.close();
console.log(`\n${templates.length} thumbnails written to public/templates/`);
