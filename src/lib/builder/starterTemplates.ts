/**
 * The templates offered in the dashboard's "Start from a template" picker.
 *
 * Metadata only. The templates themselves are real multi-page HTML sites in
 * `templates/`, packed into `.zip` archives under `public/templates/` by
 * `node templates/build.mjs` and served as ordinary static assets.
 *
 * Picking one fetches that archive in the browser and runs it through exactly
 * the same import pipeline as a user-uploaded .zip — unzip, importBundle,
 * extract the images, upload them individually, patch the pages. That reuse is
 * the point: a first-party template is worth nothing if it travels a separate,
 * less-tested code path than the one every other import uses.
 *
 * After `node templates/make-thumbs.mjs`, each `thumbnail` is a real
 * screenshot of that template's own home page, so the gallery cannot drift
 * away from what the template actually looks like.
 */

export interface StarterTemplate {
  /** Matches the folder in `templates/` and the asset basenames. */
  id: string;
  name: string;
  /** The kind of business it is written for, shown as a label on the card. */
  category: string;
  /** One line on what makes this one different, shown under the name. */
  blurb: string;
  pages: number;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'restaurant',
    name: 'Olive & Thyme',
    category: 'Restaurant & café',
    blurb: 'Warm and editorial, with the menu and opening hours as editable tables.',
    pages: 3,
  },
  {
    id: 'law-firm',
    name: 'Halloran & Reed',
    category: 'Professional services',
    blurb: 'Navy and gold. Practice areas, partner profiles and a published fee table.',
    pages: 3,
  },
  {
    id: 'fitness-studio',
    name: 'Ironworks',
    category: 'Gym & studio',
    blurb: 'Bold and high-contrast, built around a class timetable and pricing.',
    pages: 3,
  },
  {
    id: 'salon-spa',
    name: 'Lumen Studio',
    category: 'Salon & spa',
    blurb: 'Soft and unhurried, with service price lists and a work gallery.',
    pages: 3,
  },
  {
    id: 'home-services',
    name: 'Meridian',
    category: 'Trades & contractors',
    blurb: 'Phone-first, with service areas, reviews and up-front pricing.',
    pages: 3,
  },
  {
    id: 'photography',
    name: 'Field & Frame',
    category: 'Creative & portfolio',
    blurb: 'Minimal and image-led. Full-bleed galleries and a rate card.',
    pages: 3,
  },
];

export const templateThumbnail = (id: string) => `/templates/${id}.jpg`;
export const templateArchive = (id: string) => `/templates/${id}.zip`;
