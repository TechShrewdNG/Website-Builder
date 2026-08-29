/**
 * Tiles a directory of images into one screenshot for visual review.
 *
 * Written so the photography in these templates can actually be looked at
 * before it ships. Downloading an image by id and assuming it shows what the
 * filename claims is how a law firm ends up with a photograph of a dog on its
 * homepage; this makes checking fifty of them one glance instead of fifty.
 *
 * Usage: node templates/contact-sheet.mjs <dir> <out.png>
 */

import { readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir = resolve(process.argv[2] ?? '.');
const out = resolve(process.argv[3] ?? 'contact-sheet.png');

const images = readdirSync(dir)
  .filter((name) => /\.(jpe?g|png|webp|avif)$/i.test(name))
  .sort();

if (!images.length) {
  console.error(`no images in ${dir}`);
  process.exit(1);
}

// Relative srcs, with the page itself served from the image directory:
// Chromium refuses to load file:// subresources into a setContent document,
// so the sheet has to live alongside what it is showing.
const cells = images
  .map(
    (name) => `
      <figure>
        <img src="./${encodeURIComponent(name)}" alt="">
        <figcaption>${basename(name)}</figcaption>
      </figure>`,
  )
  .join('');

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; background: #101014; color: #ddd;
         font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; padding: 16px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  figure { margin: 0; }
  img { width: 100%; height: 150px; object-fit: cover; display: block;
        background: #222; border-radius: 4px; }
  figcaption { margin-top: 5px; font-size: 10.5px; color: #9a9aa4;
               word-break: break-all; }
</style>
<div class="grid">${cells}</div>`;

const sheetHtml = join(dir, '.contact-sheet.html');
writeFileSync(sheetHtml, html);

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
try {
  await page.goto(pathToFileURL(sheetHtml).href, { waitUntil: 'networkidle' });

  const broken = await page.evaluate(
    () => [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).length,
  );
  if (broken) console.warn(`warning: ${broken} image(s) failed to render`);

  await page.screenshot({ path: out, fullPage: true });
} finally {
  await browser.close();
  rmSync(sheetHtml, { force: true });
}

console.log(`${images.length} images -> ${out}`);
