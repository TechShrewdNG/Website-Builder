# Starter templates

Ten multi-page HTML templates, one per business category, written to import
into the builder as **fully editable widgets** rather than opaque markup.

| Folder | Business | Pages | Character |
| ------ | -------- | ----- | --------- |
| `restaurant/` | Restaurant, café, bar | Home, Menu, Visit | Warm cream and olive, serif display, menu and hours as tables |
| `law-firm/` | Professional services | Home, Practice areas, Contact | Navy and gold, conservative, fee table and partner bios |
| `fitness-studio/` | Gym, studio, coaching | Home, Timetable, Membership | Near-black and lime, heavy uppercase, class timetable |
| `salon-spa/` | Salon, spa, clinic | Home, Services, Visit | Blush and plum, airy serif, service price lists |
| `home-services/` | Trades, contractors | Home, Services, Contact | Blue and orange, utilitarian, phone-first CTAs |
| `photography/` | Creative, portfolio | Work, Portfolio, About | Monochrome minimal, image-led grids |
| `dental-clinic/` | Health, clinics | Home, Treatments, Book | Teal and white, clinical and calm, published fee tables |
| `estate-agency/` | Property | Home, Properties, Valuations | Stone and brass, serif display, listing cards |
| `guest-house/` | Hotel, hospitality | Home, Rooms, Find us | Cream and sage, editorial, rate tables |
| `community-trust/` | Charity, community | Home, What we do, Get involved | Slate and orange, plain-spoken, impact figures |

## Using them

They are built into the product. On the dashboard, **Start a new site → Start
from a template**: pick a card, and the site is created with its stylesheet
merged, images resolved and all three pages as real routes. Nothing to
download or upload.

The archives are also importable by hand — **Start a new site → `.zip…`**,
pointed at `public/templates/<name>.zip` — and the `Folder…` button works if
you would rather select the unpacked source directory.

### How the picker works

`public/templates/` holds a `.zip` and a `.jpg` preview per template, served
as ordinary static assets. Choosing a card fetches that archive in the
browser and hands it to the same `importBundle` pipeline an uploaded `.zip`
goes through — unzip, parse, extract the images, upload each one, patch the
pages. There is deliberately no server-side shortcut for first-party
templates: a separate code path would be a second thing to keep working.

`src/lib/builder/starterTemplates.ts` holds the card metadata (name,
category, blurb). Add an entry there and rebuild to add a template to the
gallery.

### Rebuilding after an edit

```bash
npm run templates:build     # repack the .zip archives
npm run templates:thumbs    # re-screenshot the preview images
npm run templates:audit     # confirm they still import fully editable
```

Both outputs land in `public/templates/` and are committed, so a deploy needs
no extra build step. Editing a template's source without rebuilding leaves
the gallery serving the previous version.

## Re-branding in seconds

Each template declares its whole palette as `:root` custom properties in
6-digit hex. The builder scrapes those into **Site → Design tokens** and
renders a colour picker beside each one, so an entire template can be
re-skinned by changing a handful of swatches — no CSS editing, no hunting
through elements.

The two font stacks (`--font-display`, `--font-body`) are exposed the same
way as plain text fields.

## Photography

```bash
npm run templates:photos                              # re-download every photo
node templates/contact-sheet.mjs templates/salon-spa/img /tmp/sheet.png
```

Every image is a real photograph from Unsplash. The Unsplash License permits
commercial use and redistribution without attribution, which is what makes it
safe to commit them into a repo that ships them onward inside a starter
template. `templates/fetch-photos.mjs` holds the manifest: one row per image,
carrying the photo id, the subject it is meant to show, and the width to
request. Widths are deliberately modest, because every image becomes a base64
data URL on import and D1 caps a row at 2 MB.

Photo ids in that manifest are recalled rather than looked up, so nothing is
trusted blind. `contact-sheet.mjs` tiles a directory into one screenshot so a
whole template's photography can be checked at a glance — which is how a law
firm avoids ending up with a photograph of a tropical swimming pool on its
homepage.

## Checking a template still imports cleanly

```bash
npm run templates:audit                    # all templates
npx tsx templates/audit.mjs restaurant     # just one
```

The audit runs the real client-side import pipeline and reports the widget
mix each template produces. The number that matters is **raw html nodes**:
that widget is the importer's escape hatch for markup it cannot model, and
anything landing there is content the user cannot edit with the normal
controls. All ten currently import with zero.

## Writing your own

The importer maps a specific set of tags onto editable widgets and keeps
everything else as raw HTML. Staying inside that set is the whole trick:

**Maps to an editable widget**

| Markup | Becomes |
| ------ | ------- |
| `<h1>`–`<h6>` | Heading |
| `<p>` with no child elements | Text |
| `<img>` | Image |
| `<a>` with text only | Button |
| `<a>` wrapping elements | Link box |
| `<ul>`/`<ol>` where each `<li>` is plain text or a single link | List |
| `<table>`, rectangular, no `colspan`/`rowspan` | Table |
| `<hr>` | Divider |
| `<section>`, `<header>`, `<footer>`, `<main>` | Section |
| `<div>`, `<article>`, `<aside>`, `<nav>` | Container |

**Falls back to raw HTML — avoid**

- `<button>` — use `<a class="btn">` instead
- `<form>`, `<input>`, `<select>`, `<textarea>` — there is no submission
  endpoint anyway; use `mailto:` and `tel:` links, which become buttons
- `<blockquote>`, `<figure>`, `<picture>`, `<details>`, `<dl>`, `<pre>`
- `<svg>`, `<iframe>`, `<video>`, `<audio>`, `<canvas>`
- `<i>` and any other tag with no widget equivalent

**Two quiet traps**

- `<br>` is dropped entirely on import. Never rely on it for layout.
- Inline elements inside a paragraph (`<p>text <strong>bold</strong></p>`)
  split that paragraph into several separate blocks, which changes how it
  renders. Keep `<p>` content as plain text, and put emphasis on the whole
  element with CSS instead.
- The same applies to a link inside a paragraph — `<p><a>…</a></p>` becomes a
  container. Let the anchor be a direct child and style it with a class.

`<script>` tags are dropped too, so any interactivity has to come from the
builder's own Slider, Tabs, Accordion and Counter widgets after import.
