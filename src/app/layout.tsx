import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Cormorant_Garamond, Jost, Syne } from 'next/font/google';

import './globals.css';

/**
 * Marketing typefaces, scoped to the public-facing sales surfaces (landing,
 * auth) via the `.mkt-theme` wrapper in globals.css. The dashboard and editor
 * keep Geist — a dense, information-heavy tool interface is a different job
 * than a page trying to sell someone on the product, and an editorial serif
 * display face would fight the tabular alignment those panels depend on.
 */
const mktDisplay = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-mkt-display',
});
const mktHead = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-mkt-head',
});
const mktBody = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-mkt-body',
});

export const metadata: Metadata = {
  title: 'QLEVR Canvas',
  description: 'Drag-and-drop builder for editing and building static HTML sites.',
  icons: {
    // Inline so the tab icon needs no separate asset or request.
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%23c9a84c"/><path d="M9 10h14M9 16h9M9 22h12" stroke="%230a0114" stroke-width="2.5" stroke-linecap="round"/></svg>',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${mktDisplay.variable} ${mktHead.variable} ${mktBody.variable}`}
    >
      <body className="font-sans tracking-ui">{children}</body>
    </html>
  );
}
