/**
 * Widget registry.
 *
 * One entry per widget type, describing: what it's called, what props it has,
 * and which content controls the right-hand panel should render for it.
 * Style controls are universal and live in the style panel instead.
 */

import { emptyStyles, type BuilderNode, type StyleMap, type WidgetType } from './types';

export type ControlType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'select'
  | 'toggle'
  | 'url'
  | 'image'
  | 'icon'
  | 'repeater';

export interface Control {
  key: string;
  label: string;
  type: ControlType;
  options?: { label: string; value: string }[];
  placeholder?: string;
  /** For `repeater`: the controls of one item. */
  fields?: Control[];
  /** For `repeater`: the shape of a newly added item. */
  itemDefaults?: Record<string, unknown>;
  help?: string;
}

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  /** Grouping in the palette. */
  category: 'layout' | 'content' | 'dynamic';
  icon: string;
  /** Hidden from the palette (created indirectly, e.g. `column`). */
  internal?: boolean;
  defaultProps: Record<string, unknown>;
  /** Styles applied when the widget is first dropped. */
  defaultStyles?: StyleMap;
  controls: Control[];
  /** True if the widget needs the export-time JS runtime. */
  needsRuntime?: boolean;
}

const LINK_CONTROLS: Control[] = [
  { key: 'href', label: 'Link', type: 'url', placeholder: 'https://example.com' },
  {
    key: 'target',
    label: 'Open in',
    type: 'select',
    options: [
      { label: 'Same tab', value: '_self' },
      { label: 'New tab', value: '_blank' },
    ],
  },
];

export const WIDGETS: Record<WidgetType, WidgetDefinition> = {
  // ---- layout -------------------------------------------------------------
  section: {
    type: 'section',
    label: 'Section',
    category: 'layout',
    icon: '▭',
    defaultProps: { tag: 'section', contentWidth: 'boxed', maxWidth: '1140px' },
    defaultStyles: { 'padding-top': '60px', 'padding-bottom': '60px' },
    controls: [
      {
        key: 'tag',
        label: 'HTML tag',
        type: 'select',
        options: ['section', 'header', 'footer', 'main', 'div'].map((v) => ({ label: v, value: v })),
      },
      {
        key: 'contentWidth',
        label: 'Content width',
        type: 'select',
        options: [
          { label: 'Boxed', value: 'boxed' },
          { label: 'Full width', value: 'full' },
        ],
      },
      { key: 'maxWidth', label: 'Max width', type: 'text', placeholder: '1140px' },
    ],
  },
  container: {
    type: 'container',
    label: 'Container',
    category: 'layout',
    icon: '▢',
    defaultProps: { tag: 'div' },
    defaultStyles: { display: 'flex', 'flex-direction': 'column', gap: '16px' },
    controls: [
      {
        key: 'tag',
        label: 'HTML tag',
        type: 'select',
        options: ['div', 'article', 'aside', 'nav'].map((v) => ({ label: v, value: v })),
      },
    ],
  },
  columns: {
    type: 'columns',
    label: 'Columns',
    category: 'layout',
    icon: '◫',
    defaultProps: { count: 2, gap: '24px', stackOn: 'mobile' },
    controls: [
      { key: 'gap', label: 'Gap', type: 'text', placeholder: '24px' },
      {
        key: 'stackOn',
        label: 'Stack on',
        type: 'select',
        options: [
          { label: 'Mobile', value: 'mobile' },
          { label: 'Tablet', value: 'tablet' },
          { label: 'Never', value: 'never' },
        ],
      },
    ],
  },
  column: {
    type: 'column',
    label: 'Column',
    category: 'layout',
    icon: '│',
    internal: true,
    defaultProps: { width: '' },
    controls: [
      {
        key: 'width',
        label: 'Width',
        type: 'text',
        placeholder: 'auto',
        help: 'CSS flex-basis, e.g. 50% or 320px. Blank shares space evenly.',
      },
    ],
  },

  // ---- content ------------------------------------------------------------
  heading: {
    type: 'heading',
    label: 'Heading',
    category: 'content',
    icon: 'H',
    defaultProps: { text: 'Your headline here', level: 'h2' },
    defaultStyles: { 'font-size': '32px', 'font-weight': '700', 'line-height': '1.25' },
    controls: [
      { key: 'text', label: 'Text', type: 'textarea' },
      {
        key: 'level',
        label: 'Level',
        type: 'select',
        options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((v) => ({ label: v.toUpperCase(), value: v })),
      },
    ],
  },
  text: {
    type: 'text',
    label: 'Text',
    category: 'content',
    icon: '¶',
    defaultProps: {
      html: '<p>Write something worth reading. Double-click on the canvas to edit this text inline.</p>',
    },
    defaultStyles: { 'font-size': '16px', 'line-height': '1.7' },
    controls: [{ key: 'html', label: 'Content', type: 'richtext' }],
  },
  image: {
    type: 'image',
    label: 'Image',
    category: 'content',
    icon: '🖼',
    defaultProps: { src: '', alt: '', href: '', target: '_self', loading: 'lazy' },
    defaultStyles: { 'max-width': '100%', height: 'auto' },
    controls: [
      { key: 'src', label: 'Image', type: 'image' },
      { key: 'alt', label: 'Alt text', type: 'text', help: 'Describe the image for screen readers and SEO.' },
      ...LINK_CONTROLS,
      {
        key: 'loading',
        label: 'Loading',
        type: 'select',
        options: [
          { label: 'Lazy', value: 'lazy' },
          { label: 'Eager', value: 'eager' },
        ],
      },
    ],
  },
  button: {
    type: 'button',
    label: 'Button',
    category: 'content',
    icon: '⬢',
    defaultProps: { text: 'Click me', href: '#', target: '_self' },
    defaultStyles: {
      display: 'inline-block',
      'background-color': '#6366f1',
      color: '#ffffff',
      'padding-top': '12px',
      'padding-right': '24px',
      'padding-bottom': '12px',
      'padding-left': '24px',
      'border-radius': '6px',
      'text-decoration': 'none',
      'font-weight': '600',
    },
    controls: [{ key: 'text', label: 'Label', type: 'text' }, ...LINK_CONTROLS],
  },
  icon: {
    type: 'icon',
    label: 'Icon',
    category: 'content',
    icon: '★',
    defaultProps: { glyph: '★', href: '' },
    defaultStyles: { 'font-size': '32px', 'line-height': '1' },
    controls: [
      { key: 'glyph', label: 'Icon', type: 'icon' },
      { key: 'href', label: 'Link', type: 'url' },
    ],
  },
  divider: {
    type: 'divider',
    label: 'Divider',
    category: 'content',
    icon: '─',
    defaultProps: {},
    defaultStyles: { 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': '#e5e7eb' },
    controls: [],
  },
  spacer: {
    type: 'spacer',
    label: 'Spacer',
    category: 'content',
    icon: '↕',
    defaultProps: { height: '48px' },
    controls: [{ key: 'height', label: 'Height', type: 'text', placeholder: '48px' }],
  },
  link: {
    type: 'link',
    label: 'Link box',
    category: 'content',
    icon: '🔗',
    defaultProps: { href: '#', target: '_self' },
    defaultStyles: { display: 'block', 'text-decoration': 'none', color: 'inherit' },
    controls: LINK_CONTROLS,
  },

  // ---- dynamic ------------------------------------------------------------
  slider: {
    type: 'slider',
    label: 'Slider',
    category: 'dynamic',
    icon: '⇄',
    needsRuntime: true,
    defaultProps: {
      autoplay: false,
      interval: 5000,
      loop: true,
      showArrows: true,
      showDots: true,
      slides: [
        { image: '', heading: 'First slide', text: 'Describe what matters here.' },
        { image: '', heading: 'Second slide', text: 'And here.' },
      ],
    },
    controls: [
      { key: 'autoplay', label: 'Autoplay', type: 'toggle' },
      { key: 'interval', label: 'Interval (ms)', type: 'number' },
      { key: 'loop', label: 'Loop', type: 'toggle' },
      { key: 'showArrows', label: 'Show arrows', type: 'toggle' },
      { key: 'showDots', label: 'Show dots', type: 'toggle' },
      {
        key: 'slides',
        label: 'Slides',
        type: 'repeater',
        itemDefaults: { image: '', heading: 'New slide', text: '' },
        fields: [
          { key: 'image', label: 'Image', type: 'image' },
          { key: 'heading', label: 'Heading', type: 'text' },
          { key: 'text', label: 'Text', type: 'textarea' },
        ],
      },
    ],
  },
  tabs: {
    type: 'tabs',
    label: 'Tabs',
    category: 'dynamic',
    icon: '▤',
    needsRuntime: true,
    defaultProps: {
      items: [
        { title: 'Tab one', html: '<p>First panel.</p>' },
        { title: 'Tab two', html: '<p>Second panel.</p>' },
      ],
    },
    controls: [
      {
        key: 'items',
        label: 'Tabs',
        type: 'repeater',
        itemDefaults: { title: 'New tab', html: '<p></p>' },
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'html', label: 'Content', type: 'richtext' },
        ],
      },
    ],
  },
  accordion: {
    type: 'accordion',
    label: 'Accordion',
    category: 'dynamic',
    icon: '☰',
    needsRuntime: true,
    defaultProps: {
      allowMultiple: false,
      items: [
        { title: 'First question', html: '<p>The answer.</p>' },
        { title: 'Second question', html: '<p>Another answer.</p>' },
      ],
    },
    controls: [
      { key: 'allowMultiple', label: 'Allow multiple open', type: 'toggle' },
      {
        key: 'items',
        label: 'Items',
        type: 'repeater',
        itemDefaults: { title: 'New item', html: '<p></p>' },
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'html', label: 'Content', type: 'richtext' },
        ],
      },
    ],
  },
  counter: {
    type: 'counter',
    label: 'Counter',
    category: 'dynamic',
    icon: '#',
    needsRuntime: true,
    defaultProps: { start: 0, end: 100, duration: 2000, prefix: '', suffix: '+' },
    defaultStyles: { 'font-size': '48px', 'font-weight': '700' },
    controls: [
      { key: 'start', label: 'Start at', type: 'number' },
      { key: 'end', label: 'Count to', type: 'number' },
      { key: 'duration', label: 'Duration (ms)', type: 'number' },
      { key: 'prefix', label: 'Prefix', type: 'text' },
      { key: 'suffix', label: 'Suffix', type: 'text' },
    ],
  },

  // ---- escape hatch -------------------------------------------------------
  html: {
    type: 'html',
    label: 'HTML',
    category: 'content',
    icon: '</>',
    defaultProps: { html: '<!-- paste markup here -->' },
    controls: [
      {
        key: 'html',
        label: 'Markup',
        type: 'textarea',
        help: 'Rendered verbatim. Imported markup the builder cannot model lands here.',
      },
    ],
  },
};

export const PALETTE = Object.values(WIDGETS).filter((w) => !w.internal);

let counter = 0;

/** Tree-unique id. Prefixed so ids read clearly in exported markup. */
export function newId(): string {
  counter += 1;
  return `n${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createNode(type: WidgetType, overrides: Partial<BuilderNode> = {}): BuilderNode {
  const def = WIDGETS[type];
  const styles = emptyStyles();
  if (def.defaultStyles) styles.desktop = { ...def.defaultStyles };

  const node: BuilderNode = {
    id: newId(),
    type,
    props: structuredCloneSafe(def.defaultProps),
    styles,
    children: [],
    ...overrides,
  };

  // A columns row is meaningless without its columns.
  if (type === 'columns' && node.children.length === 0) {
    const count = Number(node.props.count ?? 2);
    node.children = Array.from({ length: count }, () => createNode('column'));
  }
  return node;
}

/** structuredClone isn't available in every runtime we target; JSON is enough here. */
function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
