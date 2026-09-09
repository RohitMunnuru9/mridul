import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, ChevronLeft, LockKeyhole } from 'lucide-react';
import { sessionClient } from '@mridul/supabase/server';
import { DeliveryForm } from './delivery-form';

export const metadata: Metadata = {
  title: 'Checkout | Mridul by MR',
  description: 'Confirm your contact and delivery details securely.',
};

export default async function CheckoutPage() {
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/auth?next=/checkout');

  const [{ data: profile }, { data: address }] = await Promise.all([
    db.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    db.from('addresses').select('full_name, phone, line1, line2, landmark, city, state, pincode').eq('customer_id', user.id).eq('is_default', true).maybeSingle(),
  ]);

  const defaults = {
    fullName: address?.full_name ?? profile?.full_name ?? String(user.user_metadata.full_name ?? ''),
    phone: address?.phone ?? profile?.phone ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    landmark: address?.landmark ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    pincode: address?.pincode ?? '',
  };

  return (
    <div className="checkout-page page-shell">
      <Link className="auth-back" href="/bag"><ChevronLeft aria-hidden="true" /> Back to bag</Link>
      <div className="checkout-heading">
        <div><p className="eyebrow">Secure checkout</p><h1>Contact & delivery</h1><p>Confirm where your order should go and how we should contact you.</p></div>
        <LockKeyhole aria-hidden="true" />
      </div>

      <div className="checkout-progress" aria-label="Checkout progress">
        <span className="is-complete"><i><Check aria-hidden="true" /></i> Sign in</span>
        <span className="is-current"><i>2</i> Delivery</span>
        <span><i>3</i> Payment</span>
      </div>

      <DeliveryForm defaults={defaults} email={user.email ?? ''} />
    </div>
  );
}

