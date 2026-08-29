/**
 * Downloads the templates' photography from Unsplash.
 *
 * The Unsplash License permits commercial use and redistribution without
 * attribution, which is what makes it safe to commit these into a repo that
 * ships them onward inside starter templates. (The licence's one carve-out is
 * rebuilding a competing photo service, which this is not.)
 *
 * Photo ids are recalled, not looked up, so nothing here is trusted blind:
 * `node templates/contact-sheet.mjs <dir> <out.png>` renders whatever landed
 * so it can actually be looked at before it ships.
 *
 * Usage:
 *   node templates/fetch-photos.mjs              # into each template's img/
 *   node templates/fetch-photos.mjs --candidates # into /tmp for review
 */

import { mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = process.argv.includes('--candidates');

/**
 * [template, filename, unsplash id, what it should show]
 *
 * Sizes are modest on purpose: every one of these becomes a base64 data URL
 * when the template is imported, and D1 caps a row at 2 MB.
 */
const PHOTOS = [
  // --- restaurant -------------------------------------------------------
  ['restaurant', 'hero', 'photo-1552566626-52f8b828add9', 'warm restaurant interior', 1600],
  ['restaurant', 'room', 'photo-1517248135467-4c7edcad34c4', 'dining room', 1200],
  ['restaurant', 'dish-1', 'photo-1414235077428-338989a2e8c0', 'plated dish', 900],
  ['restaurant', 'dish-2', 'photo-1546069901-ba9599a7e63c', 'fresh salad bowl', 900],
  ['restaurant', 'dish-3', 'photo-1504674900247-0877df9cc836', 'cooked main course', 900],

  // --- law firm ---------------------------------------------------------
  ['law-firm', 'hero', 'photo-1589829545856-d10d557cf95f', 'law library shelves', 1600],
  ['law-firm', 'office', 'photo-1497366754035-f200968a6e72', 'professional office interior', 1200],
  ['law-firm', 'partner-1', 'photo-1573496359142-b8d87734a5a2', 'professional woman portrait', 800],
  ['law-firm', 'partner-2', 'photo-1560250097-0b93528c311a', 'professional man portrait', 800],
  ['law-firm', 'partner-3', 'photo-1592621385612-4d7129426394', 'professional woman portrait', 800],

  // --- fitness ----------------------------------------------------------
  ['fitness-studio', 'hero', 'photo-1534438327276-14e5300c3a48', 'gym floor', 1600],
  ['fitness-studio', 'floor', 'photo-1558611848-73f7eb4001a1', 'gym equipment', 1200],
  ['fitness-studio', 'coach-1', 'photo-1571019614242-c5c5dee9f50b', 'coach or athlete', 800],
  ['fitness-studio', 'coach-2', 'photo-1541534741688-6078c6bfb5c5', 'person training', 800],

  // --- salon ------------------------------------------------------------
  ['salon-spa', 'hero', 'photo-1560066984-138dadb4c035', 'salon interior', 1600],
  ['salon-spa', 'room', 'photo-1521590832167-7bcbfaa6381f', 'salon or treatment room', 1200],
  ['salon-spa', 'work-1', 'photo-1562322140-8baeececf3df', 'hair styling', 900],
  ['salon-spa', 'work-2', 'photo-1580618672591-eb180b1a973f', 'blow-dry in progress', 900],
  ['salon-spa', 'work-3', 'photo-1470259078422-826894b933aa', 'hair result', 900],

  // --- home services ----------------------------------------------------
  ['home-services', 'hero', 'photo-1621905251189-08b45d6a269e', 'plumber or engineer working', 1600],
  ['home-services', 'van', 'photo-1558618666-fcd25c85cd64', 'tools or workshop', 1200],
  ['home-services', 'work-1', 'photo-1607472586893-edb57bdc0e39', 'plumbing or pipework', 900],
  ['home-services', 'work-2', 'photo-1504328345606-18bbc8c9d7d1', 'tradesperson at work', 900],

  // --- photography ------------------------------------------------------
  ['photography', 'hero', 'photo-1519741497674-611481863552', 'wedding or event', 1600],
  ['photography', 'shot-1', 'photo-1524504388940-b1c1722653e1', 'portrait', 800],
  ['photography', 'shot-2', 'photo-1452587925148-ce544e77e70d', 'camera or landscape', 1200],
  ['photography', 'shot-3', 'photo-1511285560929-80b456fea0bc', 'wedding detail', 900],
  ['photography', 'shot-4', 'photo-1500648767791-00dcc994a43e', 'portrait', 800],
  ['photography', 'shot-5', 'photo-1493863641943-9b68992a8d07', 'documentary frame', 1200],
  ['photography', 'portrait', 'photo-1506794778202-cad84cf45f1d', 'environmental portrait', 800],

  // --- dental clinic ----------------------------------------------------
  ['dental-clinic', 'hero', 'photo-1629909613654-28e377c37b09', 'modern dental surgery', 1600],
  ['dental-clinic', 'room', 'photo-1588776814546-1ffcf47267a5', 'dental treatment room', 1200],
  ['dental-clinic', 'team-1', 'photo-1612349317150-e413f6a5b16d', 'dentist portrait', 800],
  ['dental-clinic', 'team-2', 'photo-1559839734-2b71ea197ec2', 'clinician portrait', 800],
  ['dental-clinic', 'care', 'photo-1609840114035-3c981b782dfe', 'patient care', 900],

  // --- estate agency ----------------------------------------------------
  ['estate-agency', 'hero', 'photo-1568605114967-8130f3a36994', 'house exterior', 1600],
  ['estate-agency', 'listing-1', 'photo-1600596542815-ffad4c1539a9', 'house interior', 900],
  ['estate-agency', 'listing-2', 'photo-1600585154340-be6161a56a0c', 'modern house', 900],
  ['estate-agency', 'listing-3', 'photo-1512917774080-9991f1c4c750', 'suburban house', 900],
  ['estate-agency', 'team', 'photo-1521737604893-d14cc237f11d', 'team meeting', 1200],

  // --- guest house ------------------------------------------------------
  ['guest-house', 'hero', 'photo-1534351590666-13e3e96b5017', 'harbour houses and moored boats', 1600],
  ['guest-house', 'room-1', 'photo-1611892440504-42a792e24d32', 'hotel bedroom', 900],
  ['guest-house', 'room-2', 'photo-1590490360182-c33d57733427', 'hotel bedroom', 900],
  ['guest-house', 'lounge', 'photo-1445019980597-93fa8acb246c', 'hotel lounge or breakfast', 1200],

  // --- community trust --------------------------------------------------
  ['community-trust', 'hero', 'photo-1559027615-cd4628902d4a', 'volunteers together', 1600],
  ['community-trust', 'work-1', 'photo-1593113630400-ea4288922497', 'community activity', 900],
  ['community-trust', 'work-2', 'photo-1517457373958-b7bdd4587205', 'community gathering', 900],
  ['community-trust', 'team', 'photo-1469571486292-0ba58a3f068b', 'helping hands', 1200],
];

async function download(id, width) {
  const url = `https://images.unsplash.com/${id}?w=${width}&q=68&fm=jpg&fit=crop`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  // An error page would still be a 200 with HTML in it.
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('not a JPEG');
  return buffer;
}

let ok = 0;
let failed = 0;
let bytes = 0;

for (const [template, name, id, subject, width] of PHOTOS) {
  const dir = CANDIDATES ? resolve('/tmp/photo-candidates', template) : join(HERE, template, 'img');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.jpg`);

  if (!CANDIDATES && existsSync(out) && process.argv.includes('--skip-existing')) {
    console.log(`skip  ${template}/${name}.jpg`);
    continue;
  }

  try {
    const buffer = await download(id, width);
    await writeFile(out, buffer);
    bytes += buffer.length;
    ok += 1;
    console.log(`ok    ${template}/${name}.jpg  ${(buffer.length / 1024).toFixed(0)} KB  — ${subject}`);
  } catch (cause) {
    failed += 1;
    console.log(`FAIL  ${template}/${name}.jpg  (${id}) — ${cause.message}`);
  }
}

console.log(`\n${ok} downloaded, ${failed} failed, ${(bytes / 1024 / 1024).toFixed(1)} MB total`);
if (failed) process.exitCode = 1;
