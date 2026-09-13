import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, ChevronLeft, LockKeyhole } from 'lucide-react';
import { getSiteSettings } from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { DeliveryForm } from './delivery-form';
import { PlaceOrderPanel } from './place-order-panel';

export const metadata: Metadata = {
  title: 'Checkout | Mridul by MR',
  description: 'Confirm your contact and delivery details securely.',
};

type PageProps = { searchParams: Promise<{ buy?: string }> };

export default async function CheckoutPage({ searchParams }: PageProps) {
  // "Buy now" sends people here with ?buy=now. The flag is in the URL rather
  // than inferred, so a one-piece checkout can never quietly become a bag one.
  const buyNowOnly = (await searchParams).buy === 'now';
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  // Carry the flag through sign-in, or Buy now quietly becomes a bag checkout
  // for anybody who was not already signed in.
  if (!user) {
    const back = buyNowOnly ? '/checkout?buy=now' : '/checkout';
    redirect(`/auth?next=${encodeURIComponent(back)}`);
  }

  const [{ data: profile }, { data: address }, settings] = await Promise.all([
    db.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    db.from('addresses').select('full_name, phone, line1, line2, landmark, city, state, pincode').eq('customer_id', user.id).eq('is_default', true).maybeSingle(),
    getSiteSettings(),
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
      <Link className="auth-back" href={buyNowOnly ? '/collections/new-arrivals' : '/bag'}>
        <ChevronLeft aria-hidden="true" /> {buyNowOnly ? 'Keep browsing' : 'Back to bag'}
      </Link>
      <div className="checkout-heading">
        <div><p className="eyebrow">Secure checkout</p><h1>Contact & delivery</h1><p>Confirm where your order should go and how we should contact you.</p></div>
        <LockKeyhole aria-hidden="true" />
      </div>

      <div className="checkout-progress" aria-label="Checkout progress">
        <span className="is-complete"><i><Check aria-hidden="true" /></i> Sign in</span>
        <span className={address ? 'is-complete' : 'is-current'}>
          <i>{address ? <Check aria-hidden="true" /> : 2}</i> Delivery
        </span>
        <span className={address ? 'is-current' : undefined}><i>3</i> Place order</span>
      </div>

      <DeliveryForm defaults={defaults} email={user.email ?? ''} />

      <PlaceOrderPanel
        address={
          address
            ? {
                fullName: address.full_name,
                phone: address.phone,
                line1: address.line1,
                line2: address.line2,
                landmark: address.landmark,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
              }
            : null
        }
        buyNowOnly={buyNowOnly}
        email={user.email ?? ''}
        rates={{
          freeShippingThresholdPaise: settings.freeShippingThresholdPaise,
          flatRatePaise: settings.flatShippingPaise,
        }}
      />
    </div>
  );
}
