/**
 * The icon set.
 *
 * Hand-drawn on a 24-unit grid at a single 1.6 stroke weight, rather than
 * pulled from a library — the widget palette needs glyphs for concepts like
 * "columns" and "spacer" that generic sets render as vague rectangles, and
 * mixing a library's shapes with custom ones is what produced the earlier
 * jumble of unicode symbols and colour emoji at four different weights.
 *
 * Every icon inherits `currentColor` and sizes from the `size` prop, so tone
 * and emphasis are controlled entirely by the surrounding text styles.
 */

export type IconName =
  | 'section'
  | 'container'
  | 'columns'
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'star'
  | 'divider'
  | 'spacer'
  | 'link'
  | 'slider'
  | 'tabs'
  | 'accordion'
  | 'counter'
  | 'code'
  | 'layers'
  | 'pages'
  | 'settings'
  | 'grid'
  | 'undo'
  | 'redo'
  | 'download'
  | 'globe'
  | 'desktop'
  | 'tablet'
  | 'mobile'
  | 'arrowLeft'
  | 'plus'
  | 'trash'
  | 'copy'
  | 'pencil'
  | 'upload'
  | 'check'
  | 'external'
  | 'quote'
  | 'video'
  | 'blocks';

const PATHS: Record<IconName, React.ReactNode> = {
  section: <rect x="3" y="6" width="18" height="12" rx="2" />,
  container: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </>
  ),
  columns: (
    <>
      <rect x="3" y="5" width="7.5" height="14" rx="1.5" />
      <rect x="13.5" y="5" width="7.5" height="14" rx="1.5" />
    </>
  ),
  heading: <path d="M6 5v14M18 5v14M6 12h12" />,
  text: <path d="M4 6h16M4 11h16M4 16h10" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
    </>
  ),
  button: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M8.5 12h7" />
    </>
  ),
  star: <path d="m12 4 2.3 5.1 5.7.6-4.2 3.8 1.1 5.5L12 16.3 7.1 19l1.1-5.5L4 9.7l5.7-.6z" />,
  divider: <path d="M3 12h18M6 7h12M6 17h12" opacity="1" />,
  spacer: <path d="M5 4h14M5 20h14M12 8v8M9 11l3-3 3 3M9 13l3 3 3-3" />,
  link: <path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.1 1.1M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.1-1.1" />,
  slider: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M3.5 9.5v5M20.5 9.5v5" />
    </>
  ),
  tabs: (
    <>
      <path d="M3 9h6V5h12v14H3z" />
      <path d="M3 9h18" />
    </>
  ),
  accordion: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <rect x="3" y="12" width="18" height="8" rx="1.5" />
      <path d="M17 6.5h1.5" />
    </>
  ),
  counter: <path d="M9 5 6 19M18 5l-3 14M4.5 9.5h15M3.5 14.5h15" />,
  code: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />,
  layers: <path d="m12 3 8.5 4.5L12 12 3.5 7.5zM4 12.5 12 17l8-4.5M4 17 12 21l8-4" />,
  pages: (
    <>
      <path d="M8 3h7l5 5v13H8z" />
      <path d="M14.5 3v5.5H20M4 7v14h10" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  undo: <path d="M4 9h11a5 5 0 0 1 0 10h-6M4 9l4-4M4 9l4 4" />,
  redo: <path d="M20 9H9a5 5 0 0 0 0 10h6M20 9l-4-4M20 9l-4 4" />,
  download: <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5h17M3.5 14.5h17M12 3c-5 6-5 12 0 18 5-6 5-12 0-18z" />
    </>
  ),
  desktop: (
    <>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  tablet: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5M13.5 11v5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  pencil: <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM14.5 6.5l3 3" />,
  upload: <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 20h16" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  external: <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />,
  quote: (
    <>
      <path d="M4.5 8.5A3.5 3.5 0 0 1 8 5v3.2a2.3 2.3 0 0 1-2.3 2.3H5" />
      <path d="M4.5 10.5v3A2.5 2.5 0 0 0 7 16h.5" />
      <path d="M13.5 8.5A3.5 3.5 0 0 1 17 5v3.2a2.3 2.3 0 0 1-2.3 2.3H14" />
      <path d="M13.5 10.5v3a2.5 2.5 0 0 0 2.5 2.5h.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5.5" width="14" height="13" rx="2" />
      <path d="m17 10 4-2.5v9L17 14" />
    </>
  ),
  blocks: (
    <>
      <rect x="3" y="3.5" width="8" height="8" rx="1.5" />
      <rect x="13" y="3.5" width="8" height="8" rx="1.5" />
      <rect x="3" y="13.5" width="8" height="7" rx="1.5" />
      <rect x="13" y="13.5" width="8" height="7" rx="1.5" />
    </>
  ),
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 18, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative: every icon in this app sits beside a visible text label.
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
