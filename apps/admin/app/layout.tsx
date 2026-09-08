import type { Metadata } from 'next';
import './globals.css';

/**
 * Root layout. Deliberately bare: the login page renders inside it with no
 * shell, and the gated shell lives in the (dashboard) group so the auth check
 * happens once, in one place, and cannot be forgotten on a new page.
 */

export const metadata: Metadata = {
  title: 'Mridul by MR | Admin',
  description: 'Catalogue, content, orders and settings for Mridul by MR.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
