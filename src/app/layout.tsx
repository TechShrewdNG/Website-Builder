import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import './globals.css';

export const metadata: Metadata = {
  title: 'Website Builder',
  description: 'Drag-and-drop builder for editing and building static HTML sites.',
  icons: {
    // Inline so the tab icon needs no separate asset or request.
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%23d79b3c"/><path d="M9 10h14M9 16h9M9 22h12" stroke="%231a1206" stroke-width="2.5" stroke-linecap="round"/></svg>',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans tracking-ui">{children}</body>
    </html>
  );
}
