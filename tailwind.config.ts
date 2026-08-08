import type { Config } from 'tailwindcss';

// Tailwind styles the *builder's own chrome* only. User sites are styled by
// the CSS the builder emits, which never depends on Tailwind being present.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#1e1f26',
        panelAlt: '#26272f',
        edge: '#33353f',
        accent: '#6366f1',
      },
    },
  },
  plugins: [],
};

export default config;
