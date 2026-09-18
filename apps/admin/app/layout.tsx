import type { Metadata } from 'next';
import './globals.css';
import './packing.css';

/**
 * Root layout. Deliberately bare: the login page renders inside it with no
 * shell, and the gated shell lives in the (dashboard) group so the auth check
 * happens once, in one place, and cannot be forgotten on a new page.
 */

export const metadata: Metadata = {
  title: 'Mridul by MR | Admin',
  description: 'Catalogue, content, orders and settings for Mridul by MR.',
  // Access is decided by `admin_roles`, not by whether anybody can find this
  // address — but there is still no reason for a shop's back office to turn up
  // in a search result next to its products.
  robots: { index: false, follow: false, nocache: true },
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
