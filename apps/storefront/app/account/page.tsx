import Link from 'next/link';
import type { Metadata } from 'next';
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Heart,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldAlert,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import { fetchOrders, ORDER_STATUS_LABEL } from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { formatDate, formatDateTime, formatPaise } from '@mridul/utils';
import { signOut } from '../auth/actions';

export const metadata: Metadata = {
  title: 'Your account | Mridul by MR',
  description: 'Your details, orders, addresses and saved pieces at Mridul by MR.',
};

/** Google, email and phone read better than 'google', 'email' and 'phone'. */
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  email: 'Email and password',
  phone: 'Phone number',
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

  const [{ data: profile }, { data: address }, orders] = await Promise.all([
    db.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    db.from('addresses').select('full_name, phone, line1, line2, landmark, city, state, pincode').eq('customer_id', user.id).eq('is_default', true).maybeSingle(),
    // RLS limits this to the signed-in customer's own orders; there is no
    // customer id in the query because there does not need to be one.
    fetchOrders(db, { limit: 20 }),
  ]);

  const displayName = profile?.full_name ?? String(user.user_metadata.full_name ?? 'Your account');
  const providers = (user.identities ?? []).map((identity) => identity.provider);
  const signInMethods = (providers.length > 0 ? providers : [String(user.app_metadata?.provider ?? 'email')])
    .map((provider) => PROVIDER_LABEL[provider] ?? provider);
  const verified = Boolean(user.email_confirmed_at);

  return (
    <div className="page-shell">
      <div className="account-hero">
        <span className="account-avatar" aria-hidden="true"><UserRound /></span>
        <div><p className="eyebrow">Signed in</p><h1>{displayName}</h1><p className="page-intro">{user.email}{profile?.phone ? ` · ${profile.phone}` : ''}</p></div>
        <form action={signOut} className="account-signout"><button type="submit"><LogOut aria-hidden="true" /> Sign out</button></form>
      </div>

      {/*
        Everything the account actually knows about this sign-in, shown rather
        than hidden. If any of it looks wrong to the customer, that is exactly
        the thing they need to see.
      */}
      <section className="account-details" aria-label="Your sign-in details">
        <h2>Your details</h2>
        <dl>
          <div>
            <dt><UserRound aria-hidden="true" /> Name</dt>
            <dd>{profile?.full_name ?? address?.full_name ?? 'Not added yet'}</dd>
          </div>
          <div>
            <dt><Mail aria-hidden="true" /> Email</dt>
            <dd>
              {user.email ?? '—'}
              {verified ? (
                <span className="account-verified"><BadgeCheck aria-hidden="true" /> Verified</span>
              ) : (
                <span className="account-unverified"><ShieldAlert aria-hidden="true" /> Not verified yet</span>
              )}
            </dd>
          </div>
          <div>
            <dt><Phone aria-hidden="true" /> Mobile</dt>
            <dd>{profile?.phone ?? address?.phone ?? 'Not added yet'}</dd>
          </div>
          <div>
            <dt><KeyRound aria-hidden="true" /> Sign-in method</dt>
            <dd>{signInMethods.join(' · ')}</dd>
          </div>
          <div>
            <dt><CalendarClock aria-hidden="true" /> Member since</dt>
            <dd>{formatDate(user.created_at)}</dd>
          </div>
          <div>
            <dt><CalendarClock aria-hidden="true" /> Last signed in</dt>
            <dd>{formatDateTime(user.last_sign_in_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="account-orders" aria-label="Your orders">
        <div className="account-orders-head">
          <h2><Package aria-hidden="true" /> Your orders</h2>
          {orders.length > 0 && <p>{orders.length} placed</p>}
        </div>

        {orders.length === 0 ? (
          <p className="account-orders-empty">
            No orders yet. When you place one it appears here with everything on
            it — what you bought, where it is going and what it cost.
          </p>
        ) : (
          <ul className="account-order-list">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/order/${order.number}`}>
                  <span className="account-order-main">
                    <strong>{order.number}</strong>
                    <small>
                      {formatDate(order.placedAt)} · {order.lines.length}{' '}
                      {order.lines.length === 1 ? 'piece' : 'pieces'}
                    </small>
                  </span>
                  <span className={`order-status is-${order.status}`}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                  <span className="account-order-total">{formatPaise(order.totalPaise)}</span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
