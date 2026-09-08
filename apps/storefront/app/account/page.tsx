/**
 * Account landing.
 *
 * Sign-in belongs to Supabase Auth, which is not wired up yet, so this page is
 * honest about that rather than showing a form that cannot work. What it can
 * do today is route to the two things that exist without an account — the bag
 * and the wishlist — and set out what an account will hold.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ChevronRight,
  Heart,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
  UserRound,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Your account | Mridul by MR',
  description: 'Orders, addresses and saved pieces at Mridul by MR.',
};

const SECTIONS = [
  {
    icon: Package,
    title: 'Orders',
    body: 'Every order with its payment status, invoice and current stage.',
    pending: true,
  },
  {
    icon: Truck,
    title: 'Track a shipment',
    body: 'Live tracking, plus the same updates on WhatsApp as the parcel moves.',
    pending: true,
  },
  {
    icon: MapPin,
    title: 'Addresses',
    body: 'Saved addresses, and the pincode we use to work out delivery charges.',
    pending: true,
  },
  {
    icon: Heart,
    title: 'Wishlist',
    body: 'Saved on this device now, and tied to your account once you sign in.',
    href: '/wishlist',
  },
  {
    icon: ShoppingBag,
    title: 'Bag',
    body: 'Your bag is kept on this device and will merge into your account.',
    href: '/bag',
  },
];

export default function AccountPage() {
  return (
    <div className="page-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Account</span>
      </nav>

      <div className="account-hero">
        <span className="account-avatar" aria-hidden="true">
          <UserRound />
        </span>
        <div>
          <p className="eyebrow">Not signed in</p>
          <h1>Your account</h1>
          <p className="page-intro">
            Accounts open with Supabase Auth. Until then your bag and wishlist live
            on this device, and nothing is lost when sign-in arrives — both merge
            into your account.
          </p>
        </div>
      </div>

      <div className="account-grid">
        {SECTIONS.map(({ icon: Icon, title, body, href, pending }) => {
          const content = (
            <>
              <span className="account-card-icon" aria-hidden="true">
                <Icon />
              </span>
              <h2>{title}</h2>
              <p>{body}</p>
              {pending ? (
                <span className="account-pending">Coming with accounts</span>
              ) : (
                <span className="account-go">
                  Open <ChevronRight aria-hidden="true" />
                </span>
              )}
            </>
          );

          return href ? (
            <Link className="account-card" href={href} key={title}>
              {content}
            </Link>
          ) : (
            <div className="account-card is-pending" key={title}>
              {content}
            </div>
          );
        })}
      </div>

      <section className="account-help">
        <h2>Need a hand before then?</h2>
        <p>
          Message us on WhatsApp for anything about an order, a size or a fabric —
          the same number that will send your tracking updates.
        </p>
        <a
          className="primary-cta"
          href="https://wa.me/919000000000"
          rel="noreferrer noopener"
          target="_blank"
        >
          Chat on WhatsApp
        </a>
      </section>
    </div>
  );
}
