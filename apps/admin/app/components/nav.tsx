'use client';

/**
 * Admin sidebar.
 *
 * Client-side only so the current section can be highlighted; the section list
 * itself is static because these are application areas, not content.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';

type Section = { href: string; label: string; icon: LucideIcon; group: string };

const SECTIONS: Section[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { href: '/products', label: 'Products', icon: Package, group: 'Catalogue' },
  { href: '/inventory', label: 'Inventory', icon: Boxes, group: 'Catalogue' },
  { href: '/categories', label: 'Categories', icon: Tags, group: 'Catalogue' },
  { href: '/collections', label: 'Collections', icon: Layers, group: 'Catalogue' },
  { href: '/homepage', label: 'Homepage', icon: Home, group: 'Content' },
  { href: '/media', label: 'Media', icon: ImageIcon, group: 'Content' },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, group: 'Commerce' },
  { href: '/customers', label: 'Customers', icon: Users, group: 'Commerce' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'Commerce' },
];

const GROUPS = ['Overview', 'Catalogue', 'Content', 'Commerce'];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {GROUPS.map((group) => (
        <div className="admin-nav-group" key={group}>
          <h2>{group}</h2>
          {SECTIONS.filter((section) => section.group === group).map(
            ({ href, label, icon: Icon }) => {
              const active =
                href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'is-active' : undefined}
                  href={href}
                  key={href}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Link>
              );
            },
          )}
        </div>
      ))}
    </nav>
  );
}
