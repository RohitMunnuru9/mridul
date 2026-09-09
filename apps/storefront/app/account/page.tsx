import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Heart, LogOut, MapPin, ShoppingBag, UserRound } from 'lucide-react';
import { sessionClient } from '@mridul/supabase/server';
import { signOut } from '../auth/actions';

export const metadata: Metadata = {
  title: 'Your account | Mridul by MR',
  description: 'Your details, addresses and saved pieces at Mridul by MR.',
};

export default async function AccountPage() {
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();

  if (!user) {
    return (
      <div className="account-signin page-shell">
        <span className="account-avatar" aria-hidden="true"><UserRound /></span>
        <p className="eyebrow">Your account</p>
        <h1>Sign in to see your details</h1>
        <p>Use email or Google to securely access your delivery information.</p>
        <Link className="primary-cta" href="/auth?next=/account">Sign in or create an account</Link>
      </div>
    );
  }

  const [{ data: profile }, { data: address }] = await Promise.all([
    db.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    db.from('addresses').select('full_name, phone, line1, line2, landmark, city, state, pincode').eq('customer_id', user.id).eq('is_default', true).maybeSingle(),
  ]);
  const displayName = profile?.full_name ?? String(user.user_metadata.full_name ?? 'Your account');

  return (
    <div className="page-shell">
      <div className="account-hero">
        <span className="account-avatar" aria-hidden="true"><UserRound /></span>
        <div><p className="eyebrow">Signed in</p><h1>{displayName}</h1><p className="page-intro">{user.email}{profile?.phone ? ` · ${profile.phone}` : ''}</p></div>
        <form action={signOut} className="account-signout"><button type="submit"><LogOut aria-hidden="true" /> Sign out</button></form>
      </div>

      <div className="account-grid">
        <Link className="account-card" href="/checkout">
          <span className="account-card-icon" aria-hidden="true"><MapPin /></span>
          <h2>Delivery address</h2>
          {address ? <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />{address.city}, {address.state} — {address.pincode}</p> : <p>Add the address where your orders should be delivered.</p>}
          <span className="account-go">{address ? 'Edit' : 'Add address'} <ChevronRight aria-hidden="true" /></span>
        </Link>
        <Link className="account-card" href="/wishlist"><span className="account-card-icon" aria-hidden="true"><Heart /></span><h2>Wishlist</h2><p>Return to the pieces you saved.</p><span className="account-go">Open <ChevronRight aria-hidden="true" /></span></Link>
        <Link className="account-card" href="/bag"><span className="account-card-icon" aria-hidden="true"><ShoppingBag /></span><h2>Bag</h2><p>Review your selected pieces and continue checkout.</p><span className="account-go">Open <ChevronRight aria-hidden="true" /></span></Link>
      </div>
    </div>
  );
}

