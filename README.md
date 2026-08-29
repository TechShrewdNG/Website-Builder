# Website Builder

A drag-and-drop builder for static HTML sites — Elementor-style editing, but the
input and output are plain HTML rather than WordPress. Import an existing
template or start blank, edit visually, then publish to a URL or download a
`.zip` of clean static files.

## Stack

Next.js 15 (App Router) · TypeScript · Prisma + Cloudflare D1 · Auth.js v5
(credentials) · Tailwind for the builder's own UI only — generated sites never
depend on it. Deployed to Cloudflare Workers via
[OpenNext](https://opennext.js.org/cloudflare).

## Getting started

```bash
npm install
cp .env.example .env          # sets a local-only sqlite DATABASE_URL, plus AUTH_SECRET
npm run db:migrate:dev        # create the local schema (prisma migrate dev)
npm run dev
```

`AUTH_SECRET` (`openssl rand -base64 32`) is the only thing you need to set for
real. `DATABASE_URL` in `.env` points at a throwaway local SQLite file used
only by `prisma migrate dev` when you change the schema — the deployed app
never reads it; it reaches D1 through the `DB` binding in `wrangler.jsonc`
instead. `npm run dev` runs against that D1 binding too, simulated locally by
OpenNext.

Register an account at `/register`, then create a site from `/dashboard`.

## Starter templates

`templates/` holds six multi-page HTML templates — restaurant, law firm,
fitness studio, salon, trades and photography — written specifically to
import as fully editable widgets rather than opaque markup.

```bash
node templates/build.mjs      # writes importable .zip files to templates/dist/
node templates/audit.mjs      # checks they still import with zero raw-HTML nodes
```

Each declares its palette as `:root` custom properties, which the builder
surfaces in **Site → Design tokens** with a colour picker per value, so a
template can be re-branded without editing CSS. See `templates/README.md`
for the full tag-to-widget mapping and the rules for writing your own.

## Deploying to Cloudflare Workers

The project already has `wrangler.jsonc` configured with a D1 database
(`qlevr-canvas-db`) and the `qlevr-canvas` Worker name — a separate Worker
from any other one already in the account, so this never overwrites something
else already deployed there.

**One-time setup**, from a machine with `wrangler login` run (or a
`CLOUDFLARE_API_TOKEN` with Workers Scripts:Edit + D1:Edit permissions in the
environment):

```bash
# Apply the schema to the real (remote) D1 database — only needed once,
# and again whenever prisma/schema.prisma changes and a new migrations/*.sql
# file is generated (see below).
npx wrangler d1 migrations apply qlevr-canvas-db --remote

# The one secret the app needs. DATABASE_URL is not set here — production
# never reads it.
npx wrangler secret put AUTH_SECRET
```

**Every deploy after that:**

```bash
npm run deploy   # next build && opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

**Local preview against the real D1 database** (rather than the local
simulation `npm run dev` uses): `npx wrangler dev --remote`.

**Changing the schema later:** edit `prisma/schema.prisma`, then generate the
next migration file and apply it:

```bash
npx prisma migrate diff --from-local-d1 --to-schema-datamodel prisma/schema.prisma \
  --script > migrations/0002_your_change.sql
npx wrangler d1 migrations apply qlevr-canvas-db --remote
```

### Known limits carried over from D1

- **2,000,000 bytes per row, combined across every column.** Image uploads
  (`/api/assets`) are capped at 1.4 MB raw so the base64-encoded data URL
  stays under that; `importedCss`, `customCss`, `faviconData` and
  `socialImage` are similarly capped with headroom for each other. A page's
  `tree` (its actual content) is *not* size-capped today — an extremely large,
  deeply-nested page could in principle exceed the row limit and fail to
  save. This hasn't come up in practice, but it's a real ceiling this schema
  didn't have under Postgres.
- **No true multi-statement transactions.** `$transaction([...])` (the array
  form, used for publish and page-revision restore) works via D1's batch API.
  Interactive transactions (`$transaction(async (tx) => ...)`) are not used
  anywhere in this codebase and wouldn't work if they were.

## Troubleshooting a deployment

If sign-up or sign-in fails, hit `/api/health` first. It reports which of the
things a fresh deploy usually gets wrong is actually wrong:

```json
{ "ok": false, "checks": {
    "authSecret": "MISSING — sign-in will fail",
    "dbBinding": "set",
    "database": "The database is reachable but its schema is missing. Apply migrations/0001_init.sql to it..." } }
```

"I can't create an account" almost always means the schema was never applied
to the D1 database — run the `wrangler d1 migrations apply ... --remote`
command above. API routes return these as real messages with a 503, so the
cause also shows up in the sign-up form itself rather than as a generic
failure.

## How it works

### The document model

A page is a tree of `BuilderNode`s (`src/lib/builder/types.ts`) stored as JSON
on the `Page.tree` column. A node has a widget `type`, its `props`, per-
breakpoint `styles`, and any `classes`/`attrs` preserved from imported markup.

### One renderer, three consumers

`src/lib/builder/render.ts` turns a tree into HTML, and it is the *only* thing
that does. The editor canvas, the published site, and the `.zip` export all call
it, so what you see in the editor is what ships. Editor mode only adds
attributes and placeholders — never structure — and there's a test asserting the
tag sequence is identical either way.

### Styling and the cascade

Styles compile to `[data-ws="<id>"]` rules, which avoids collisions with an
imported stylesheet's class names. Specificity alone isn't enough to make edits
stick — `[data-ws="x"]` is (0,1,0) and loses to an ordinary template rule like
`.hero h1` (0,1,1) — so the cascade uses **layers**:

| Layer         | Contents                                            |
| ------------- | ---------------------------------------------------- |
| `ws-base`     | reset + dynamic-widget presentation                   |
| `ws-template` | CSS from the imported template                        |
| *(unlayered)* | design token overrides (`:root { --brand: … }`)       |
| *(unlayered)* | CSS rule overrides (edits to the template's rules)    |
| *(unlayered)* | generated per-element styles                          |
| *(unlayered)* | your Project CSS, last                                |

Unlayered rules beat layered ones regardless of specificity, so clicking a
control always wins without `!important` anywhere. The unlayered blocks are
themselves ordered so the more specific action wins: a rule-level edit beats
the template, and selecting one element and changing it still beats editing
the rule that element happens to match.

Responsive styles are separate blocks per breakpoint (desktop / tablet ≤1024px /
mobile ≤767px), emitted as real media queries for export and publish. In the
editor they're *flattened* to the previewed breakpoint instead: the canvas iframe
is narrower than the real viewport, so media queries would fire on the iframe's
width and show mobile styles under "desktop".

### Import

Parsing runs in the browser via `DOMParser` (`src/lib/builder/importer.ts`), so
the server hosts no parser and you see warnings before committing. The rule is
**fidelity over modelling** — an imported page must look identical before you
touch it:

- classes, ids and data attributes are preserved on every node;
- the template's `<style>` blocks are kept verbatim as project CSS;
- inline `style` attributes become editable desktop styles;
- simple `<ul>`/`<ol>` lists (nav menus, feature lists) and rectangular
  `<table>`s become real List and Table widgets — editable rows and items,
  not opaque markup. A list item with block content, or a table with merged
  cells, keeps its markup verbatim instead, since flattening either would
  silently drop content;
- forms, SVG, embeds and anything else with no faithful widget equivalent are
  kept as raw HTML rather than approximated into something that renders
  differently.

Known limits, surfaced as warnings at import time:

- `<script>` tags are dropped. Re-add what you need via an HTML widget.

#### Folder and .zip import

A single `.html` file leaves everything it references dangling — a linked
stylesheet is unreachable, local images 404. Importing a whole folder or
`.zip` (`src/lib/builder/bundle.ts`) resolves that instead:

- every `.html` file becomes a page, with `index.html` leading regardless of
  archive order — it has to, since the first page becomes the site's `/`;
- `<link rel="stylesheet">` targets found in the bundle are read and merged,
  once each even when several pages share one file;
- local images are inlined as data URLs and every reference rewritten —
  `<img src>`, slider images, and `url(...)` inside both inline styles and
  linked stylesheets, resolved relative to whichever file referenced them;
- absolute URLs (`https://…`) are left as `<link>`/`src` references, never
  reported as missing;
- anything that still can't be resolved is listed by exact path in the import
  summary rather than silently dropped or silently broken — the file may
  exist on the server the site is going to, so the reference is kept as-is.

#### CSS rule editing and design tokens

The per-element style panel only ever wrote `[data-ws="id"]` overrides — right
for one element, wrong for a template, where changing `.btn` should change
every button. `parseRules()` (`src/lib/builder/css.ts`) scans the imported
stylesheet with a small brace-depth scanner (not a full CSS parser — it never
needs to reproduce the source) and the inspector lists every rule that matches
the selected element, editable in place.

Edits are stored as a selector-keyed override map on the project rather than
rewritten into the imported stylesheet, so the original is never reformatted
and clearing an edit restores the template's value exactly. They compile
unlayered — see below — so they beat the template regardless of specificity,
and *before* per-element styles, so "select an element and change it" is still
the most specific action available.

`:root { --custom-property: … }` declarations are surfaced separately as
design tokens (Site panel), so a template's whole palette can be recoloured
from one place instead of hunting down every reference to a hex value.

`@import` is hoisted above the cascade layer it would otherwise sit inside —
browsers drop an `@import` that isn't the first thing in a stylesheet, which
would silently take a template's webfonts with it.

Per-element styling also gained `:hover`/`:focus` states, applied at every
breakpoint rather than per-width — hover has no meaning on a touch device, so
a per-breakpoint hover matrix would quadruple the panel for a case nobody
asks for.

### Global header and footer

A site's header and footer live on the project, not duplicated per page, so an
edit propagates by construction rather than by a sync step that could fail.
`composePage()` splices them around a page's content, producing one tree — which
means CSS compilation, rendering and export handle globals with no special
casing. In the editor they're rendered around the page but marked locked: their
nodes aren't in the editable tree, so selection and drop targeting miss them by
construction, and they're edited by pointing the canvas at them from the Pages
panel.

### SEO and sharing

Each page carries a description, social image and noindex flag. Published pages
and exports emit `description`, the `og:` and `twitter:` families (no single tag
is read by every platform), and a canonical URL. Exports also write
`sitemap.xml` and `robots.txt` — the sitemap needs absolute URLs, so it appears
only once the site's public URL is set under Site.

### Revisions

Snapshots are explicit — taken on demand, not on every autosave — so the list
stays navigable. Restoring snapshots the current tree first, which makes the
restore itself undoable.

### Widgets

Layout: section, container, columns. Content: heading, text, image, button,
icon, divider, spacer, link box, list, table, quote, video, rating, raw HTML.
Dynamic: slider, tabs, accordion, counter.

Dynamic widgets render accessible static markup (roles, `aria-selected`,
`aria-expanded`) that reads correctly with JS off; a single dependency-free
runtime (`src/lib/builder/runtime.ts`) progressively enhances it. It ships only
when a page actually uses one of those widgets, and it's idempotent, because the
editor re-runs it after every canvas render.

The style panel's "Transform & motion" group (`transform`, `transition`,
`cursor`) is universal, same as every other style group — it applies to any
widget, not just a fixed subset.

### Blocks

`src/lib/builder/blocks.ts` holds pre-built sections — hero, feature grid,
testimonial (single and row), pricing table, CTA banner, FAQ, team grid,
footer — each a real `BuilderNode` tree built from `createNode`, the same way
`templates.ts` builds a starting page. The difference is where they land: a
template seeds a whole new page, a block drops onto a page that already has
content, from the editor's **Blocks** tab (next to **Elements**, inside the
Widgets panel).

Dropping a block inserts it at the end of the page and re-IDs every node via
`cloneWithNewIds`, so nothing in it is special-cased — the heading, buttons
and columns it's made of are immediately editable, reorderable and deletable
exactly like anything dragged in from the widget palette. Drag-and-drop
reuses the same `DragPayload` channel as copy/paste (a `{ kind: 'block',
node }` payload carrying a whole subtree), rather than a new mechanism.

### Publishing and export

Publishing snapshots each page's tree into `publishedTree`, so continuing to
edit never leaks half-finished work onto a live URL. Sites are served at
`/s/<slug>/<path>`.

Export produces a standalone static site: `index.html`, `about/index.html`, a
shared `assets/styles.css`, and `assets/builder.js` if needed. Data-URL images
are extracted back into real files under `assets/images/` and deduplicated.
Asset paths are made relative to each page's depth, so it works on any host.

## Builder UI

The chrome is styled from one set of tokens in `src/app/globals.css`, exposed to
Tailwind as RGB channel triplets so opacity modifiers (`bg-accent/15`) work
against them. Deep purple near-black surfaces, a single gold accent (matching
the QLEVR reference site), and Geist for both text and numerals — the style
panel uses tabular figures so values line up column to column.

Icons are a hand-drawn set in `src/components/Icon.tsx`, one 1.6 stroke weight
on a 24-unit grid. They replaced a mix of unicode symbols and colour emoji that
rendered at four different weights.

None of this reaches a generated site. Exported and published pages are styled
entirely by the CSS the builder emits, which never assumes Tailwind or these
variables exist — there is a test asserting the export contains no editor-only
markup.

`node test/screenshots.mjs <outDir>` captures every surface for reviewing
design changes.

### The marketing theme

The landing page and auth pages (`/`, `/login`, `/register`) carry the same
deep purple/gold palette as the dashboard and editor, plus a three-font
pairing on top of it (Syne for labels, Cormorant Garamond italic for display
headlines, Jost for body) via `next/font/google` in `layout.tsx`. It is
namespaced under a `.mkt-theme` wrapper class with its own `--mkt-*` custom
properties in `globals.css` and a parallel `mkt*` colour/font set in
`tailwind.config.ts` — the actual RGB values are kept in sync with the
`--ws-*` tokens the dashboard and editor use, so the palette reads as one
system; only the typefaces differ.

The split is deliberate, not incidental: the dashboard and editor are a dense
working tool where tabular alignment and quick scanning matter more than
editorial flair, so they keep Geist rather than the three-font treatment. The
landing and auth pages exist to sell the product, which is a different job,
so they use the heavier, serif-and-display pairing on the same colours.
Applying the marketing fonts everywhere would clutter the tool with serif
italics it doesn't need.

The feature section on the landing page embeds real screenshots of the editor
(`public/marketing/*.png`) rather than illustrations or icons — evidence that
the product exists and works, not a mockup of it.

## Tests

```bash
npm test                  # 68 unit tests: model, CSS, render, runtime, export, import, bundles
npm run typecheck
```

The unit suite covers the tree operations (including the invariants that stop a
drop from corrupting the document), CSS compilation and breakpoint flattening,
escaping, the dynamic-widget runtime driven in a real DOM via jsdom, export
layout, the list/table import mapping, `@import` hoisting, the CSS rule
scanner (including a brace inside a quoted string, which would desync a naive
one), and the bundle importer's path resolution and asset rewriting.

Browser checks need a running server and a registered account:

```bash
npm run build && npm start
npm run test:e2e                                # editor: selection, DnD, styles, autosave, publish
npm run test:e2e:import path/to/page.html       # single-file import fidelity and override behaviour
npm run test:e2e:import-features path/to/page.html  # list/table widgets, CSS rule editing, tokens
npm run test:e2e:bundle path/to/site.zip        # .zip import: merged CSS, resolved images, multi-page
npm run test:e2e:bundle-folder path/to/site/    # folder import (webkitdirectory), same checks
npm run test:e2e:features                       # globals, SEO, snapshots, media, clipboard
```

These drive Chromium through Playwright and cover what unit tests can't:
cross-iframe drag-and-drop, inline editing, whether a style edit visually beats
the imported stylesheet, and whether editing `.btn` in the rule editor actually
restyles every button on the live canvas.

## Security notes

Two things worth knowing before running this with untrusted users:

- **Published sites share this app's origin.** A `<script>` pasted into an HTML
  widget would otherwise run with same-origin privileges, so published pages are
  served with a nonce-based CSP that permits only the builder's own runtime.
  Hosting user sites on a separate domain would be the stronger fix.
- **Rich-text and HTML widgets are rendered verbatim**, by design — it's the
  user's own site. Combined with the CSP above, markup is free-form but scripts
  don't execute.

Image uploads are capped at 1.4 MB and stored as data URLs on the `Asset` row
to keep the stack to one dependency (D1). Moving to R2 means changing only
`src/app/api/assets/route.ts` and the meaning of the `data` column.

## What isn't built

Scoped honestly, since these are the obvious next asks:

- Custom domains for published sites (only `/s/<slug>` today).
- Forms — there's no submission endpoint, so no form widget.
- A full CSS parser. The rule scanner in `src/lib/builder/css.ts` treats
  selectors as opaque strings, so ordinary selectors and pseudo-classes
  (`:has()` included) parse fine, and rules nested inside `@media`/`@supports`
  are found regardless of depth. What it doesn't handle is *native CSS
  nesting* — a selector rule nested inside another selector rule
  (`.card { & > img { … } }`) rather than inside an at-rule — which produces
  a garbled declaration instead of two separate editable rules. The template
  still renders exactly as authored either way, since the original
  stylesheet is never rewritten; only the rule *editor's* view of it is
  affected.
- Multi-user collaboration.
