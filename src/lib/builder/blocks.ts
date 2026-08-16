/**
 * Starter blocks.
 *
 * A template (see `templates.ts`) seeds a whole new page; a block is the
 * smaller unit — one section dropped onto a page that already has content,
 * the same way a widget is. Both are real BuilderNode trees built from
 * `createNode`, so a block is editable the instant it lands: every heading,
 * button and column is already addressable in the layer tree and the style
 * panel, nothing about it is special-cased markup.
 *
 * Copy is written as plausible draft content rather than lorem ipsum, so a
 * block reads like a section you edit down, not a wireframe you fill in.
 */

import { columns, heading, node, section, text, INK, MUTED, type Node } from './templates';

export interface BlockDefinition {
  id: string;
  name: string;
  description: string;
  /** Groups blocks in the panel. */
  category: 'Hero' | 'Content' | 'Social proof' | 'Conversion' | 'Footer';
  build: () => Node;
}

const ACCENT = '#6b21c8';

type StyleMapArg = Parameters<typeof node>[2];

function card(children: Node[], styles: StyleMapArg = {}): Node {
  const created = node(
    'container',
    { tag: 'div' },
    {
      display: 'flex',
      'flex-direction': 'column',
      gap: '14px',
      padding: '28px',
      'border-radius': '14px',
      'border-width': '1px',
      'border-style': 'solid',
      'border-color': '#e6e3db',
      'background-color': '#ffffff',
      ...styles,
    },
  );
  created.children = children;
  return created;
}

// ---------------------------------------------------------------------------

function heroCentered(): Node {
  const buttonRow = node('container', { tag: 'div' }, { display: 'flex', 'justify-content': 'center', gap: '12px' });
  buttonRow.children = [
    node('button', { text: 'Get started', href: '#' }, {
      'background-color': INK,
      color: '#ffffff',
      'padding-top': '14px',
      'padding-right': '28px',
      'padding-bottom': '14px',
      'padding-left': '28px',
      'border-radius': '999px',
      'text-decoration': 'none',
      'font-weight': '600',
      display: 'inline-block',
    }),
  ];

  return section(
    [
      heading('A headline that says what you do', 'h1', { 'text-align': 'center', margin: '0 auto 18px', 'max-width': '18ch' }),
      text('<p>One or two sentences backing that up. Say who this is for and what changes once they use it.</p>', {
        'text-align': 'center',
        margin: '0 auto 28px',
        'max-width': '48ch',
        'font-size': '18px',
      }),
      buttonRow,
    ],
    { 'padding-top': '96px', 'padding-bottom': '96px' },
  );
}

function heroSplit(): Node {
  const copy = [
    heading('A headline that says what you do', 'h1', { 'max-width': '14ch' }),
    text('<p>One or two sentences backing that up. Say who this is for and what changes once they use it.</p>', {
      'font-size': '18px',
      margin: '0 0 28px',
    }),
    node('button', { text: 'Get started', href: '#' }, {
      'background-color': INK,
      color: '#ffffff',
      'padding-top': '14px',
      'padding-right': '28px',
      'padding-bottom': '14px',
      'padding-left': '28px',
      'border-radius': '999px',
      'text-decoration': 'none',
      'font-weight': '600',
      display: 'inline-block',
    }),
  ];
  const image = node('image', { src: '', alt: '' }, { width: '100%', 'border-radius': '12px' });
  return section([columns(2, [copy, [image]], { 'align-items': 'center' })], {
    'padding-top': '80px',
    'padding-bottom': '80px',
  });
}

function featureGrid3(): Node {
  const items = [
    { title: 'Fast to start', body: 'Get from nothing to a working page in minutes, not days.' },
    { title: 'Nothing hidden', body: 'What you see in the editor is exactly what gets published.' },
    { title: 'Yours to keep', body: 'Export the real HTML and CSS whenever you want, no lock-in.' },
  ];
  const cols = items.map((item) => [
    node('icon', { glyph: '★', href: '' }, { 'font-size': '28px', color: ACCENT, margin: '0 0 12px' }),
    heading(item.title, 'h3', { 'font-size': '19px', margin: '0 0 8px' }),
    text(`<p>${item.body}</p>`, { 'font-size': '15px' }),
  ]);
  return section(
    [
      heading('What you get', 'h2', { 'text-align': 'center', margin: '0 auto 48px' }),
      columns(3, cols),
    ],
    { 'padding-top': '80px', 'padding-bottom': '80px' },
  );
}

function testimonialSingle(): Node {
  return section(
    [
      node(
        'quote',
        {
          text: 'This made it so much easier to get our site live. It just works.',
          name: 'Jordan Blake',
          role: 'Founder, Studio Nine',
          avatar: '',
        },
        { 'font-size': '24px', 'font-weight': '500', 'text-align': 'center', 'max-width': '32ch', margin: '0 auto', color: INK },
      ),
    ],
    { 'padding-top': '80px', 'padding-bottom': '80px' },
  );
}

function testimonialRow(): Node {
  const quotes = [
    { text: 'Set up our whole site in an afternoon.', name: 'Priya N.', role: 'Marketing Lead' },
    { text: 'The kind of tool that gets out of the way.', name: 'Marcus T.', role: 'Founder' },
    { text: 'Exported the code and never looked back.', name: 'Elena R.', role: 'Designer' },
  ];
  const cols = quotes.map((q) => [
    card([node('quote', { text: q.text, name: q.name, role: q.role, avatar: '' }, { 'font-size': '15.5px' })], {
      'border-color': '#e6e3db',
    }),
  ]);
  return section(
    [heading('What people say', 'h2', { 'text-align': 'center', margin: '0 auto 40px' }), columns(3, cols)],
    { 'padding-top': '80px', 'padding-bottom': '80px' },
  );
}

function pricing3(): Node {
  const plans = [
    { name: 'Starter', price: '$0', tag: 'Try it out', features: ['One site', 'Community support'] },
    { name: 'Pro', price: '$19/mo', tag: 'Most popular', features: ['Unlimited sites', 'Priority support', 'Custom domain'] },
    { name: 'Team', price: '$49/mo', tag: 'For teams', features: ['Everything in Pro', 'Shared projects', 'Roles & permissions'] },
  ];
  const cols = plans.map((plan) => [
    card(
      [
        text(`<p>${plan.tag}</p>`, { 'font-size': '12px', 'font-weight': '700', 'text-transform': 'uppercase', 'letter-spacing': '0.08em', color: ACCENT, margin: '0' }),
        heading(plan.name, 'h3', { 'font-size': '22px', margin: '0' }),
        heading(plan.price, 'h4', { 'font-size': '32px', margin: '0 0 6px' }),
        node('list', { ordered: false, items: plan.features.map((f) => ({ text: f, href: '' })) }, { 'font-size': '14.5px', color: MUTED }),
        node('button', { text: 'Choose plan', href: '#' }, {
          'background-color': INK,
          color: '#ffffff',
          'padding-top': '12px',
          'padding-bottom': '12px',
          'text-align': 'center',
          'border-radius': '8px',
          'text-decoration': 'none',
          'font-weight': '600',
          display: 'block',
        }),
      ],
      { 'border-color': plan.name === 'Pro' ? ACCENT : '#e6e3db', 'border-width': plan.name === 'Pro' ? '2px' : '1px' },
    ),
  ]);
  return section(
    [heading('Simple pricing', 'h2', { 'text-align': 'center', margin: '0 auto 48px' }), columns(3, cols)],
    { 'padding-top': '80px', 'padding-bottom': '80px' },
  );
}

function ctaBanner(): Node {
  const buttonRow = node('container', { tag: 'div' }, { display: 'flex', 'justify-content': 'center' });
  buttonRow.children = [
    node('button', { text: 'Get started', href: '#' }, {
      'background-color': '#ffffff',
      color: INK,
      'padding-top': '14px',
      'padding-right': '28px',
      'padding-bottom': '14px',
      'padding-left': '28px',
      'border-radius': '999px',
      'text-decoration': 'none',
      'font-weight': '600',
      display: 'inline-block',
    }),
  ];

  return section(
    [
      heading('Ready to get started?', 'h2', { 'text-align': 'center', color: '#ffffff', margin: '0 auto 12px' }),
      text('<p>Set up your first page in the next few minutes.</p>', {
        'text-align': 'center',
        color: 'rgba(255,255,255,.82)',
        margin: '0 auto 28px',
      }),
      buttonRow,
    ],
    { 'padding-top': '72px', 'padding-bottom': '72px', 'background-color': ACCENT },
  );
}

function faqSection(): Node {
  return section(
    [
      heading('Questions, answered', 'h2', { 'text-align': 'center', margin: '0 auto 40px' }),
      node(
        'accordion',
        {
          allowMultiple: false,
          items: [
            { title: 'How does billing work?', html: '<p>Monthly, cancel any time. No contracts.</p>' },
            { title: 'Can I export my site?', html: '<p>Yes, the full HTML and CSS, on every plan.</p>' },
            { title: 'Do you offer support?', html: '<p>Yes, by email, with same-day replies on weekdays.</p>' },
          ],
        },
        { 'max-width': '640px', margin: '0 auto' },
      ),
    ],
    { 'padding-top': '80px', 'padding-bottom': '80px' },
  );
}

function teamGrid(): Node {
  const people = [
    { name: 'Amara Diallo', role: 'Co-founder' },
    { name: 'Ben Okafor', role: 'Engineering' },
    { name: 'Chloe Winters', role: 'Design' },
  ];
  const cols = people.map((person) => [
    node('image', { src: '', alt: person.name }, { width: '100%', 'aspect-ratio': '1/1', 'object-fit': 'cover', 'border-radius': '12px', margin: '0 0 14px' }),
    heading(person.name, 'h3', { 'font-size': '17px', margin: '0 0 4px' }),
    text(`<p>${person.role}</p>`, { 'font-size': '14px', color: MUTED }),
  ]);
  return section(
    [heading('The team', 'h2', { 'text-align': 'center', margin: '0 auto 44px' }), columns(3, cols)],
    { 'padding-top': '80px', 'padding-bottom': '80px' },
  );
}

function footerColumns(): Node {
  const linkColumn = (title: string, links: string[]) => [
    heading(title, 'h4', { 'font-size': '13px', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', margin: '0 0 14px' }),
    node(
      'list',
      { ordered: false, items: links.map((label) => ({ text: label, href: '#' })) },
      { 'font-size': '14px', 'line-height': '2', color: MUTED },
    ),
  ];
  return section(
    [
      columns(4, [
        [
          heading('Your brand', 'h3', { 'font-size': '18px', margin: '0 0 10px' }),
          text('<p>A short line about what you do.</p>', { 'font-size': '14px' }),
        ],
        linkColumn('Product', ['Features', 'Pricing', 'Changelog']),
        linkColumn('Company', ['About', 'Blog', 'Careers']),
        linkColumn('Legal', ['Privacy', 'Terms']),
      ]),
      text(`<p>© ${new Date().getFullYear()} Your brand. All rights reserved.</p>`, {
        'font-size': '13px',
        color: MUTED,
        'text-align': 'center',
        margin: '40px 0 0',
      }),
    ],
    {
      'padding-top': '56px',
      'padding-bottom': '32px',
      'border-top-width': '1px',
      'border-top-style': 'solid',
      'border-top-color': '#e6e3db',
    },
    { tag: 'footer', contentWidth: 'boxed', maxWidth: '1080px' },
  );
}

// ---------------------------------------------------------------------------

export const BLOCKS: BlockDefinition[] = [
  { id: 'hero-centered', name: 'Hero, centered', description: 'Headline, copy and buttons, centered.', category: 'Hero', build: heroCentered },
  { id: 'hero-split', name: 'Hero, split', description: 'Copy and a button on one side, an image on the other.', category: 'Hero', build: heroSplit },
  { id: 'feature-grid', name: 'Feature grid', description: 'Three columns of icon, heading and text.', category: 'Content', build: featureGrid3 },
  { id: 'faq', name: 'FAQ', description: 'A heading and a stack of question-and-answer items.', category: 'Content', build: faqSection },
  { id: 'team-grid', name: 'Team grid', description: 'Repeating photo, name and role cards.', category: 'Content', build: teamGrid },
  { id: 'testimonial-single', name: 'Testimonial, single', description: 'One large pull-quote with attribution.', category: 'Social proof', build: testimonialSingle },
  { id: 'testimonial-row', name: 'Testimonials, row', description: 'Three quote cards side by side.', category: 'Social proof', build: testimonialRow },
  { id: 'pricing', name: 'Pricing table', description: 'Three plan cards, each with a price, features and a button.', category: 'Conversion', build: pricing3 },
  { id: 'cta-banner', name: 'CTA banner', description: 'A full-width closing banner with a heading and a button.', category: 'Conversion', build: ctaBanner },
  { id: 'footer-columns', name: 'Footer, columns', description: 'A multi-column footer with link groups and a copyright line.', category: 'Footer', build: footerColumns },
];

export function getBlock(id: string): BlockDefinition | undefined {
  return BLOCKS.find((block) => block.id === id);
}
