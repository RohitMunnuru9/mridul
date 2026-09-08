'use client';

/**
 * Site header.
 *
 * Three things it has to get right: the shop navigation is data, not markup,
 * so the admin panel can change it; every control goes somewhere real, so no
 * icon is decorative; and the whole thing shrinks once you start scrolling, so
 * a phone gives its screen back to the products.
 *
 * The desktop dropdowns are built from the catalogue itself — a fabric appears
 * in the menu because a product uses it, which means a menu link can never
 * lead to an empty listing.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react';
import { BrandMark } from './brand-mark';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { Collection, NavMenu } from '@mridul/types';
import { useStore } from '../providers/store-provider';

/**
 * The strip above the header.
 *
 * A rotating brand line is the point of it; the shipping promise rides along
 * on wider screens because there is room, not because it needs to be here —
 * it already appears on the value strip, in the bag and on every product page.
 *
 * Both come from settings, so marketing owns the words.
 */
function AnnouncementBar({
  quotes,
  utility,
}: {
  quotes: string[];
  utility?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (quotes.length < 2) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % quotes.length),
      6500,
    );
    return () => clearInterval(timer);
  }, [quotes.length]);

  if (quotes.length === 0 && !utility) return null;

  return (
    <div className="announcement-bar">
      {utility && <span className="announcement-utility">{utility}</span>}
      {quotes.length > 0 && (
        <p aria-live="polite" className="announcement-quote" key={index}>
          <span aria-hidden="true">&#10022;</span>
          {quotes[index % quotes.length]}
          <span aria-hidden="true">&#10022;</span>
        </p>
      )}
    </div>
  );
}

function MegaMenu({ menu }: { menu: NavMenu }) {
  return (
    <div className="mega-menu">
      <div className="mega-groups">
        {menu.groups.map((group) => (
          <div key={group.label}>
            <h3>{group.label}</h3>
            {group.links.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      {menu.feature && (
        <Link className="mega-feature" href={menu.feature.href}>
          <div className="mega-feature-photo">
            <Image
              src={menu.feature.image.url}
              alt={menu.feature.image.alt}
              fill
              sizes="220px"
              style={{ objectPosition: menu.feature.image.focal }}
            />
          </div>
          <p className="eyebrow">Latest in</p>
          <strong>{menu.feature.name}</strong>
          <span>
            {menu.feature.priceLabel} <ArrowRight aria-hidden="true" />
          </span>
        </Link>
      )}
    </div>
  );
}

export function StorefrontHeader({
  menus,
  collections,
  announcements,
  quotes,
}: {
  menus: NavMenu[];
  /** Already filtered to the edits that belong in the nav. */
  collections: Collection[];
  announcements: string[];
  quotes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, wishlist } = useStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collapse the header once the page has moved, so the products get the room.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes whatever was open.
  useEffect(() => {
    setOpenMenu(null);
    setSearchOpen(false);
  }, [pathname]);

  /** A small delay stops the dropdown flickering as the pointer crosses a gap. */
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 140);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = term.trim();
    if (!next) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(next)}`);
  }

  return (
    <>
      <AnnouncementBar quotes={quotes} utility={announcements[0]} />
      <div className={`navigation-stack${compact ? ' is-compact' : ''}`}>
        <header className="site-header">
          <div className="mobile-nav">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    // Pinned rather than generated. base-ui derives this from
                    // useId, which resolves differently in the RSC render and
                    // the hydration pass under vinext, producing a mismatch
                    // React refuses to patch.
                    id="mobile-nav-trigger"
                    variant="ghost"
                    size="icon"
                    aria-label="Open navigation"
                    className="header-icon"
                  />
                }
              >
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="left" className="mobile-menu-panel">
                <SheetHeader>
                  <SheetTitle>
                    <BrandMark />
                  </SheetTitle>
                  <SheetDescription>
                    Thoughtful drapes for every kind of day.
                  </SheetDescription>
                </SheetHeader>

                <nav aria-label="Mobile navigation" className="mobile-links">
                  {menus.map((menu) => (
                    <Link href={`/shop/${menu.categorySlug}`} key={menu.categorySlug}>
                      {menu.categoryName}
                      <span aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </nav>

                <div className="mobile-collections">
                  <h3>Edits</h3>
                  <div>
                    {collections.map((collection) => (
                      <Link
                        href={`/collections/${collection.slug}`}
                        key={collection.id}
                      >
                        {collection.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mobile-utility">
                  <Link href="/account">
                    <UserRound aria-hidden="true" /> Account
                  </Link>
                  <Link href="/wishlist">
                    <Heart aria-hidden="true" /> Wishlist
                  </Link>
                  <Link href="/bag">
                    <ShoppingBag aria-hidden="true" /> Bag
                  </Link>
                </div>

                <div className="mobile-menu-note">
                  <span>Made slowly</span>
                  <strong>In conversation with craft</strong>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <BrandMark />

          <nav
            className="desktop-navigation"
            aria-label="Primary navigation"
            onMouseLeave={scheduleClose}
          >
            {menus.map((menu) => (
              <div
                className={`nav-item${openMenu === menu.categorySlug ? ' is-open' : ''}`}
                key={menu.categorySlug}
                onMouseEnter={() => {
                  cancelClose();
                  setOpenMenu(menu.categorySlug);
                }}
              >
                <Link
                  aria-expanded={openMenu === menu.categorySlug}
                  href={`/shop/${menu.categorySlug}`}
                  onFocus={() => setOpenMenu(menu.categorySlug)}
                >
                  {menu.categoryName}
                  <ChevronDown aria-hidden="true" />
                </Link>
                {openMenu === menu.categorySlug && <MegaMenu menu={menu} />}
              </div>
            ))}
            <div className="nav-item">
              <Link href="/collections/new-arrivals">New in</Link>
            </div>
            <div className="nav-item">
              <Link className="accent-link" href="/shop/sarees?sale=1">
                Sale
              </Link>
            </div>
          </nav>

          <div className="header-actions">
            <Button
              variant="ghost"
              size="icon"
              className="header-icon"
              aria-label={searchOpen ? 'Close search' : 'Search'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              {searchOpen ? <X aria-hidden="true" /> : <Search aria-hidden="true" />}
            </Button>
            <Link
              className="header-icon-link desktop-action"
              href="/account"
              aria-label="Your account"
            >
              <UserRound aria-hidden="true" />
            </Link>
            <Link
              className="header-icon-link desktop-action count-holder"
              href="/wishlist"
              aria-label={`Wishlist, ${wishlist.length} items`}
            >
              <Heart aria-hidden="true" />
              {wishlist.length > 0 && <span>{wishlist.length}</span>}
            </Link>
            <Link
              className="header-icon-link count-holder"
              href="/bag"
              aria-label={`Shopping bag, ${cartCount} items`}
            >
              <ShoppingBag aria-hidden="true" />
              <span>{cartCount}</span>
            </Link>
          </div>
        </header>

        <nav className="mobile-category-nav" aria-label="Shop categories">
          {menus.map((menu) => (
            <Link href={`/shop/${menu.categorySlug}`} key={menu.categorySlug}>
              {menu.categoryName}
            </Link>
          ))}
          {collections.map((collection) => (
            <Link href={`/collections/${collection.slug}`} key={collection.id}>
              {collection.name}
            </Link>
          ))}
        </nav>

        {searchOpen && (
          <form className="search-drawer" onSubmit={submitSearch} role="search">
            <label htmlFor="site-search">Find your next favourite</label>
            <div>
              <Search aria-hidden="true" />
              <input
                autoFocus
                id="site-search"
                name="q"
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search sarees, blouses, fabrics…"
                type="search"
                value={term}
              />
              <Button className="search-submit" type="submit">
                Search
              </Button>
            </div>
            <div className="search-quick">
              <span>Popular</span>
              {['Linen', 'Organza', 'Handloom', 'Wedding'].map((suggestion) => (
                <Link href={`/search?q=${suggestion}`} key={suggestion}>
                  {suggestion}
                </Link>
              ))}
            </div>
          </form>
        )}
      </div>
    </>
  );
}
