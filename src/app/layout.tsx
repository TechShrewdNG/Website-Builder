import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Website Builder',
  description: 'Drag-and-drop builder for editing and building static HTML sites.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
