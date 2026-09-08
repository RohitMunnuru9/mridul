'use client';

/**
 * Mobile quick navigation.
 *
 * Lives in the layout so it survives navigation, marks the current tab, and
 * takes its badge counts from the shared store rather than page state. Shop is
 * the centre tab because it is the one people reach for: it opens the shop
 * index, which leads with the same collections the homepage features.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Home, ShoppingBag, Store, UserRound } from 'lucide-react';
import { useStore } from '../providers/store-provider';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/wishlist', label: 'Wishlist', icon: Heart, badge: 'wishlist' },
  { href: '/shop', label: 'Shop', icon: Store, centre: true },
  { href: '/account', label: 'Account', icon: UserRound },
  { href: '/bag', label: 'Bag', icon: ShoppingBag, badge: 'bag' },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount, wishlist } = useStore();

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        const count =
          'badge' in tab
            ? tab.badge === 'bag'
              ? cartCount
              : wishlist.length
            : 0;

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={`${'centre' in tab ? 'shop-tab' : ''}${active ? ' is-active' : ''}`}
            href={tab.href}
            key={tab.href}
          >
            <Icon aria-hidden="true" />
            <span>{tab.label}</span>
            {count > 0 && <b>{count}</b>}
          </Link>
        );
      })}
    </nav>
  );
}
