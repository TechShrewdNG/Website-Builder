/**
 * Starter templates.
 *
 * Each is a real BuilderNode tree, not markup — so a template is editable the
 * moment it lands, with every section, column and widget already addressable
 * in the layer tree. Building them from `createNode` means they inherit widget
 * defaults and can never drift out of sync with the registry.
 *
 * Copy is written as plausible draft content rather than lorem ipsum, so a new
 * page reads like a real page you edit down, not a wireframe you fill in.
 */

import { createRoot } from './tree';
import { createNode } from './widgets';
import type { BuilderNode, StyleMap } from './types';

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  /** Also seeds the site's global header and footer where it makes sense. */
  build: () => { page: BuilderNode; header?: BuilderNode; footer?: BuilderNode };
}

type Node = BuilderNode;

function node(type: Parameters<typeof createNode>[0], props: Record<string, unknown> = {}, styles: StyleMap = {}): Node {
  const created = createNode(type);
  created.props = { ...created.props, ...props };
  created.styles.desktop = { ...created.styles.desktop, ...styles };
  return created;
}

function section(children: Node[], styles: StyleMap = {}, props: Record<string, unknown> = {}): Node {
  const created = node('section', props, styles);
  created.children = children;
  return created;
}

function columns(count: number, contents: Node[][], styles: StyleMap = {}): Node {
  const created = node('columns', { count, gap: '28px' }, styles);
  created.children = contents.map((children) => {
    const column = createNode('column');
    column.children = children;
    return column;
  });
  return created;
}

const INK = '#151513';
const MUTED = '#5b5a55';

function heading(text: string, level = 'h2', styles: StyleMap = {}): Node {
  return node(
    'heading',
    { text, level },
    {
      'font-size': level === 'h1' ? '52px' : level === 'h2' ? '34px' : '20px',
      'font-weight': '700',
      'line-height': '1.15',
      'letter-spacing': '-0.02em',
      color: INK,
      margin: '0 0 16px',
      ...styles,
    },
  );
}

function text(html: string, styles: StyleMap = {}): Node {
  return node('text', { html }, { 'font-size': '17px', 'line-height': '1.7', color: MUTED, ...styles });
}

// ---------------------------------------------------------------------------

function buildHeader(brand: string, links: string[]): Node {
  const row = node('container', { tag: 'div' }, {
    display: 'flex',
    'flex-direction': 'row',
    'justify-content': 'space-between',
    'align-items': 'center',
    gap: '24px',
  });

  const name = node('heading', { text: brand, level: 'h3' }, {
    'font-size': '19px',
    'font-weight': '700',
    'letter-spacing': '-0.02em',
    color: INK,
    margin: '0',
  });

  const nav = node('container', { tag: 'nav' }, {
    display: 'flex',
    'flex-direction': 'row',
    gap: '26px',
    'align-items': 'center',
  });
  nav.children = links.map((label) =>
    node(
      'button',
      { text: label, href: label === 'Home' ? '/' : `/${label.toLowerCase().replace(/\s+/g, '-')}` },
      {
        'background-color': 'transparent',
        color: MUTED,
        'padding-top': '0',
        'padding-right': '0',
        'padding-bottom': '0',
        'padding-left': '0',
        'font-size': '15px',
        'font-weight': '500',
        'text-decoration': 'none',
        'border-radius': '0',
      },
    ),
  );

  row.children = [name, nav];

  return section(
    [row],
    { 'padding-top': '22px', 'padding-bottom': '22px', 'background-color': '#ffffff' },
    { tag: 'header', contentWidth: 'boxed', maxWidth: '1080px' },
  );
}

function buildFooter(brand: string): Node {
  return section(
    [
      text(`<p>© ${new Date().getFullYear()} ${brand}. Built with Website Builder.</p>`, {
        'font-size': '14px',
        color: '#8a887f',
        'text-align': 'center',
      }),
    ],
    {
      'padding-top': '34px',
      'padding-bottom': '34px',
      'border-top-width': '1px',
      'border-top-style': 'solid',
      'border-top-color': '#e6e3db',
    },
    { tag: 'footer', contentWidth: 'boxed', maxWidth: '1080px' },
  );
}

// ---------------------------------------------------------------------------

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'blank',
    name: 'Blank page',
    description: 'One empty section. Start from nothing.',
    build: () => ({ page: createRoot([createNode('section')]) }),
  },

  {
    id: 'landing',
    name: 'Landing page',
    description: 'Hero, three benefits, stats and a closing call to action.',
    build: () => {
      const hero = section(
        [
          heading('Coffee roasted the week you drink it', 'h1', { 'font-size': '54px', 'max-width': '15ch' }),
          text(
            '<p>We roast in small batches on Tuesdays and ship the same afternoon, so what reaches you is days old rather than months.</p>',
            { 'font-size': '19px', 'max-width': '48ch', margin: '0 0 32px' },
          ),
          node('button', { text: 'Order a bag', href: '/shop' }, {
            'background-color': INK,
            color: '#ffffff',
            'padding-top': '15px',
            'padding-bottom': '15px',
            'padding-left': '30px',
            'padding-right': '30px',
            'border-radius': '999px',
            'font-size': '16px',
          }),
        ],
        { 'padding-top': '104px', 'padding-bottom': '96px', 'background-color': '#faf8f3' },
      );

      const benefits = columns(
        3,
        [
          [heading('Small batches', 'h3'), text('<p>Never more than 12kg at a time, so nothing sits waiting.</p>')],
          [heading('Named farms', 'h3'), text('<p>Every bag lists the farm, altitude and the price we paid.</p>')],
          [heading('Ships Tuesday', 'h3'), text('<p>Order by Monday evening and it leaves the next afternoon.</p>')],
        ],
      );

      const stats = columns(
        3,
        [
          [node('counter', { end: 43, suffix: '', prefix: '' }, { color: INK, 'text-align': 'center' }), text('<p>Farms we buy from</p>', { 'text-align': 'center', 'font-size': '15px' })],
          [node('counter', { end: 12, suffix: 'kg' }, { color: INK, 'text-align': 'center' }), text('<p>Largest batch size</p>', { 'text-align': 'center', 'font-size': '15px' })],
          [node('counter', { end: 6, suffix: ' days' }, { color: INK, 'text-align': 'center' }), text('<p>Average age on arrival</p>', { 'text-align': 'center', 'font-size': '15px' })],
        ],
      );

      const closing = section(
        [
          heading('Start with the Tuesday box', 'h2', { 'text-align': 'center' }),
          text('<p>Three 250g bags, rotating every month. Cancel whenever.</p>', {
            'text-align': 'center',
            margin: '0 0 28px',
          }),
          node('button', { text: 'Subscribe', href: '/subscribe' }, {
            'background-color': INK,
            color: '#ffffff',
            'border-radius': '999px',
            'padding-top': '15px',
            'padding-bottom': '15px',
            'padding-left': '30px',
            'padding-right': '30px',
          }),
        ],
        { 'padding-top': '84px', 'padding-bottom': '96px', 'text-align': 'center', 'background-color': '#faf8f3' },
      );

      return {
        page: createRoot([
          hero,
          section([heading('Why it tastes different', 'h2', { 'text-align': 'center', margin: '0 0 44px' }), benefits], {
            'padding-top': '88px',
            'padding-bottom': '88px',
          }),
          section([stats], { 'padding-top': '20px', 'padding-bottom': '88px' }),
          closing,
        ]),
        header: buildHeader('Ridgeline', ['Home', 'Shop', 'About']),
        footer: buildFooter('Ridgeline'),
      };
    },
  },

  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Intro, selected work in two columns, and contact details.',
    build: () => {
      const intro = section(
        [
          heading('Amara Okonkwo', 'h1', { 'font-size': '48px', margin: '0 0 12px' }),
          text('<p>Industrial designer in Lisbon. I work on furniture, lighting and the occasional kettle.</p>', {
            'font-size': '19px',
            'max-width': '46ch',
          }),
        ],
        { 'padding-top': '96px', 'padding-bottom': '64px' },
      );

      const work = columns(2, [
        [
          node('image', { src: '', alt: 'Oak reading chair, 2025' }, { 'border-radius': '10px', 'background-color': '#eeebe3', height: '260px', width: '100%' }),
          heading('Reading chair', 'h3', { margin: '18px 0 6px' }),
          text('<p>Steam-bent oak, wool webbing. Made with Praça Studio, 2025.</p>', { 'font-size': '15px' }),
        ],
        [
          node('image', { src: '', alt: 'Aluminium desk lamp, 2024' }, { 'border-radius': '10px', 'background-color': '#eeebe3', height: '260px', width: '100%' }),
          heading('Desk lamp', 'h3', { margin: '18px 0 6px' }),
          text('<p>Anodised aluminium, counterweighted arm. Self-initiated, 2024.</p>', { 'font-size': '15px' }),
        ],
      ]);

      const contact = section(
        [
          heading('Working on something?', 'h2'),
          text('<p>amara@okonkwo.studio — usually replies within a day or two.</p>'),
        ],
        {
          'padding-top': '72px',
          'padding-bottom': '96px',
          'border-top-width': '1px',
          'border-top-style': 'solid',
          'border-top-color': '#e6e3db',
        },
      );

      return {
        page: createRoot([intro, section([work], { 'padding-top': '0', 'padding-bottom': '80px' }), contact]),
        header: buildHeader('Amara Okonkwo', ['Work', 'About', 'Contact']),
        footer: buildFooter('Amara Okonkwo'),
      };
    },
  },

  {
    id: 'about',
    name: 'About page',
    description: 'A narrow single-column story page with an FAQ accordion.',
    build: () => {
      const body = section(
        [
          heading('About', 'h1', { 'font-size': '44px' }),
          text(
            '<p>We started in 2019 in a converted garage in Porto, roasting for two cafés who were tired of stale beans. Seven years later we roast for forty, and the Tuesday schedule has never moved.</p>' +
              '<p>There are eleven of us now. Nobody works weekends.</p>',
            { 'font-size': '18px' },
          ),
          node('accordion', {
            items: [
              { title: 'Do you ship outside the EU?', html: '<p>Not yet — customs made the coffee arrive too old to be worth it.</p>' },
              { title: 'Can I visit the roastery?', html: '<p>Thursdays after 3pm. Email ahead so someone is there.</p>' },
              { title: 'What happens to unsold stock?', html: '<p>It goes to two shelters in Porto every Friday.</p>' },
            ],
          }, { margin: '40px 0 0' }),
        ],
        { 'padding-top': '88px', 'padding-bottom': '96px' },
        { contentWidth: 'boxed', maxWidth: '680px' },
      );

      return {
        page: createRoot([body]),
        header: buildHeader('Ridgeline', ['Home', 'Shop', 'About']),
        footer: buildFooter('Ridgeline'),
      };
    },
  },
];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
