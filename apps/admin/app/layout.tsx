import type { Metadata } from 'next';
import { getSiteSettings } from '@mridul/database';
import { AdminNav } from './components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mridul by MR | Admin',
  description: 'Catalogue, content, orders and settings for Mridul by MR.',
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();

  return (
    <html lang="en">
      <body>
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-brand">
              {settings.brandName.split(' ')[0]}
              <span>Admin</span>
            </div>
            <AdminNav />
            <p className="admin-note">
              <strong>Read-only preview.</strong> Every section reads the live
              catalogue and content the storefront renders. Editing, roles and
              row-level security arrive with Supabase Auth.
            </p>
          </aside>
          <main className="admin-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
