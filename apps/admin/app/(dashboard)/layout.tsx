import { redirect } from 'next/navigation';
import { getSiteSettings } from '@mridul/database';
import { currentAdmin } from '@mridul/supabase/server';
import { AdminNav } from '../components/nav';
import { signOut } from '../login/actions';

/**
 * The gate.
 *
 * Every page in this group renders behind it, so a new section cannot
 * accidentally ship unprotected. The database policies would refuse the
 * queries regardless — this is the second lock, not the only one.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await currentAdmin();
  if (!admin) redirect('/login');

  const settings = await getSiteSettings();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          {settings.brandName.split(' ')[0]}
          <span>Admin</span>
        </div>
        <AdminNav />
        <div className="admin-account">
          <p>
            <strong>{admin.email}</strong>
            {admin.roles.join(', ').replace(/_/g, ' ')}
          </p>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
