# Website Builder

A drag-and-drop builder for static HTML sites — Elementor-style editing, but the
input and output are plain HTML rather than WordPress. Import an existing
template or start blank, edit visually, then publish to a URL or download a
`.zip` of clean static files.

## Stack

Next.js 15 (App Router) · TypeScript · Prisma + PostgreSQL · Auth.js v5
(credentials) · Tailwind for the builder's own UI only — generated sites never
depend on it.

## Getting started

```bash
npm install
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET
npm run db:push               # create the schema
npm run dev
```

Those two variables are all that's required — `DATABASE_URL` for Postgres and
`AUTH_SECRET` to sign session tokens (`openssl rand -base64 32`).

Register an account at `/register`, then create a site from `/dashboard`.

## Deploying to Vercel

Only two environment variables are required on the project:

| Variable       | Notes                                              |
| -------------- | -------------------------------------------------- |
| `DATABASE_URL` | Must be a **pooled** connection string (see below) |
| `AUTH_SECRET`  | `openssl rand -base64 32`                          |

There is deliberately no URL variable. `trustHost` is set, so Auth.js infers
its own origin from the incoming request and the app works unchanged across
preview and production deployments. Set `AUTH_URL` only if you mount the app
under a path prefix, or sit behind a proxy that rewrites the `Host` header.

Serverless functions open a connection per invocation, so a direct Postgres URL
will exhaust the connection limit under load. Use your provider's pooler —
Neon's pooled endpoint, Supabase's port 6543, or PgBouncer — and append
`?pgbouncer=true&connection_limit=1` for PgBouncer-style poolers.

`prisma generate` runs in both `postinstall` and `build`, which is what keeps
the client from going stale against Vercel's dependency cache. Run
`npm run db:push` (or a migration) against the production database once before
the first deploy; the build itself never touches the database.

Dependencies are pinned and `npm audit` reports zero vulnerabilities. Two
`overrides` pin `postcss` and `sharp` inside Next's own dependency tree, which
is the only way to patch those without jumping to Next 16. `sharp` is unused at
runtime anyway, since `images.unoptimized` is set — generated sites are static
HTML and don't go through the image pipeline.

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

| Layer         | Contents                            |
| ------------- | ----------------------------------- |
| `ws-base`     | reset + dynamic-widget presentation |
| `ws-template` | CSS from the imported template      |
| *(unlayered)* | generated per-element styles        |
| *(unlayered)* | your Project CSS, last              |

Unlayered rules beat layered ones regardless of specificity, so clicking a
control always wins without `!important` anywhere.

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
- tables, forms, lists, SVG and embeds are kept as raw HTML rather than
  approximated into something that would render differently.

Known limits, surfaced as warnings at import time:

- `<script>` tags are dropped. Re-add what you need via an HTML widget.
- Stylesheets referenced by *relative* path can't be fetched; paste their
  contents into Project CSS. Absolute `https://` ones are carried through as
  `<link>` tags.

### Widgets

Layout: section, container, columns. Content: heading, text, image, button,
icon, divider, spacer, link box, raw HTML. Dynamic: slider, tabs, accordion,
counter.

Dynamic widgets render accessible static markup (roles, `aria-selected`,
`aria-expanded`) that reads correctly with JS off; a single dependency-free
runtime (`src/lib/builder/runtime.ts`) progressively enhances it. It ships only
when a page actually uses one of those widgets, and it's idempotent, because the
editor re-runs it after every canvas render.

### Publishing and export

Publishing snapshots each page's tree into `publishedTree`, so continuing to
edit never leaks half-finished work onto a live URL. Sites are served at
`/s/<slug>/<path>`.

Export produces a standalone static site: `index.html`, `about/index.html`, a
shared `assets/styles.css`, and `assets/builder.js` if needed. Data-URL images
are extracted back into real files under `assets/images/` and deduplicated.
Asset paths are made relative to each page's depth, so it works on any host.

## Tests

```bash
npm test                  # 29 unit tests: model, CSS, render, runtime, export
npm run typecheck
```

The unit suite covers the tree operations (including the invariants that stop a
drop from corrupting the document), CSS compilation and breakpoint flattening,
escaping, the dynamic-widget runtime driven in a real DOM via jsdom, and export
layout.

Browser checks need a running server and a registered account:

```bash
npm run build && npm start
npm run test:e2e                          # editor: selection, DnD, styles, autosave, publish
npm run test:e2e:import path/to/page.html # import fidelity and override behaviour
```

These drive Chromium through Playwright and cover what unit tests can't:
cross-iframe drag-and-drop, inline editing, and whether a style edit visually
beats the imported stylesheet.

## Security notes

Two things worth knowing before running this with untrusted users:

- **Published sites share this app's origin.** A `<script>` pasted into an HTML
  widget would otherwise run with same-origin privileges, so published pages are
  served with a nonce-based CSP that permits only the builder's own runtime.
  Hosting user sites on a separate domain would be the stronger fix.
- **Rich-text and HTML widgets are rendered verbatim**, by design — it's the
  user's own site. Combined with the CSP above, markup is free-form but scripts
  don't execute.

Image uploads are capped at 2 MB and stored as data URLs on the `Asset` row to
keep the stack to one dependency. Moving to S3/R2 means changing only
`src/app/api/assets/route.ts` and the meaning of the `data` column.

## What isn't built

Scoped honestly, since these are the obvious next asks:

- Custom domains for published sites (only `/s/<slug>` today).
- Forms — there's no submission endpoint, so no form widget.
- Global theme tokens (colour/font palettes) — the `Project.theme` column is
  reserved for this but only carries imported stylesheet links today.
- Reusable/global sections, revision history beyond in-session undo, and
  multi-user collaboration.
