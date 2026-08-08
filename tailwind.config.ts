import type { Config } from 'tailwindcss';

// Tailwind styles the *builder's own chrome* only. User sites are styled by
// the CSS the builder emits, which never depends on Tailwind being present.
//
// Colours map onto the CSS variables in globals.css so there is a single
// source of truth for the palette.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--ws-bg) / <alpha-value>)',
        panel: 'rgb(var(--ws-panel) / <alpha-value>)',
        panelRaised: 'rgb(var(--ws-panel-raised) / <alpha-value>)',
        edge: 'rgb(var(--ws-edge) / <alpha-value>)',
        edgeStrong: 'rgb(var(--ws-edge-strong) / <alpha-value>)',
        muted: 'rgb(var(--ws-text-muted) / <alpha-value>)',
        faint: 'rgb(var(--ws-text-faint) / <alpha-value>)',
        accent: 'rgb(var(--ws-accent) / <alpha-value>)',
        accentHover: 'rgb(var(--ws-accent-hover) / <alpha-value>)',
        accentInk: 'rgb(var(--ws-accent-ink) / <alpha-value>)',
        danger: 'rgb(var(--ws-danger) / <alpha-value>)',
        positive: 'rgb(var(--ws-positive) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        // Large type needs negative tracking to stop looking loose.
        display: '-0.03em',
        ui: '-0.011em',
      },
      keyframes: {
        'ws-rise': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'ws-rise': 'ws-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
