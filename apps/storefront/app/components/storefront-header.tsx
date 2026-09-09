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

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  ChevronDown,
  Heart,
  LogIn,
  Menu,
  MessageCircle,
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
  whatsapp = '',
}: {
  menus: NavMenu[];
  /** Already filtered to the edits that belong in the nav. */
  collections: Collection[];
  announcements: string[];
  quotes: string[];
  /** Powers the Contact us row. Without it that row is left out. */
  whatsapp?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, wishlist } = useStore();

  const [searchOpen, setSearchOpen] = useState(false);

  /**
   * What the search box suggests, taken from the catalogue rather than typed
   * here: the category names, then the fabrics, weaves and occasions the
   * navigation already lists. Add a fabric in the admin and it turns up here.
   */
  const suggestions = useMemo(() => {
    const categories = menus.map((menu) => menu.categoryName);
    const facets = menus.flatMap((menu) =>
      menu.groups.flatMap((group) => group.links.map((link) => link.label)),
    );
    const seen = new Set<string>();
    return [...categories, ...facets].filter((label) => {
      const key = label.toLowerCase();
      if (seen.has(key) || label.length > 22) return false;
      seen.add(key);
      return true;
    });
  }, [menus]);

  const [hint, setHint] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The drawer is mounted by a deliberate click, so focus follows it into the
   * field. Done with a ref rather than `autoFocus`, which fires on any mount
   * and cannot be reasoned about from the call site.
   */
  function focusOnOpen(node: HTMLInputElement | null) {
    node?.focus();
  }

  // Collapse the header once the page has moved, so the products get the room.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes whatever was open. Adjusted during render rather
  // than in an effect: an effect would paint the new page with the old menu
  // still open for a frame.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenMenu(null);
    setSearchOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!searchOpen || term || suggestions.length < 2) return undefined;
    const id = setInterval(
      () => setHint((current) => (current + 1) % suggestions.length),
      2400,
    );
    return () => clearInterval(id);
  }, [searchOpen, term, suggestions.length]);

  /**
   * The hero sits directly under this, and needs to know how tall it is to
   * fill the rest of the screen. Measured rather than guessed: the
   * announcement bar comes and goes and the rows wrap at different widths.
   */
  const chromeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = chromeRef.current;
    if (!node) return undefined;
    const publish = () =>
      document.documentElement.style.setProperty(
        '--chrome-height',
        `${Math.round(node.getBoundingClientRect().height)}px`,
      );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
    // The strip and the header stick together as one block. Sticking only the
    // header would let the quote scroll away and leave a seam behind it.
    <div
      className={`site-chrome refined-chrome${compact ? ' is-compact' : ''}`}
      ref={chromeRef}
    >
      <AnnouncementBar quotes={quotes} utility={announcements[0]} />
      <div className={`navigation-stack${compact ? ' is-compact' : ''}`}>
        <header className="site-header">
          <div className="mobile-nav">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
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
              <SheetContent
                side="left"
                className="mobile-menu-panel"
                onClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest('a')
                  )
                    setMobileOpen(false);
                }}
              >
                <SheetHeader>
                  <SheetTitle>
                    <BrandMark />
                  </SheetTitle>
                  <SheetDescription>
                    Thoughtful drapes for every kind of day.
                  </SheetDescription>
                </SheetHeader>

                {/* One row system for the whole drawer. It was a stack of
                    oversized links, then a row of pills, then a cramped strip
                    of icons — three different ways of saying "go here". */}
                <nav aria-label="Mobile navigation" className="mobile-nav-groups">
                  <section className="mobile-group">
                    <h3>Shop</h3>
                    <div className="mobile-rows">
                      {menus.map((menu) => (
                        <Link
                          className="mobile-row is-lead"
                          href={`/shop/${menu.categorySlug}`}
                          key={menu.categorySlug}
                        >
                          <span className="mobile-row-label">{menu.categoryName}</span>
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      ))}
                      {collections.map((collection) => (
                        <Link
                          className="mobile-row is-lead"
                          href={`/collections/${collection.slug}`}
                          key={collection.id}
                        >
                          <span className="mobile-row-label">{collection.name}</span>
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  </section>

                  <section className="mobile-group">
                    <h3>Your account</h3>
                    <div className="mobile-rows">
                      <Link className="mobile-row" href="/auth">
                        <LogIn aria-hidden="true" />
                        <span className="mobile-row-label">Sign in or register</span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                      <Link className="mobile-row" href="/account">
                        <UserRound aria-hidden="true" />
                        <span className="mobile-row-label">Account</span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                      <Link className="mobile-row" href="/wishlist">
                        <Heart aria-hidden="true" />
                        <span className="mobile-row-label">Wishlist</span>
                        {wishlist.length > 0 && (
                          <em className="mobile-row-count">{wishlist.length}</em>
                        )}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                      <Link className="mobile-row" href="/bag">
                        <ShoppingBag aria-hidden="true" />
                        <span className="mobile-row-label">Bag</span>
                        {cartCount > 0 && <em className="mobile-row-count">{cartCount}</em>}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </div>
                  </section>

                  {/* wa.me wants digits only, the same as the chat button. */}
                  {whatsapp.replace(/\D/g, '') && (
                    <section className="mobile-group">
                      <h3>Help</h3>
                      <div className="mobile-rows">
                        <a
                          className="mobile-row"
                          href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          <MessageCircle aria-hidden="true" />
                          <span className="mobile-row-label">Contact us</span>
                          <small className="mobile-row-note">WhatsApp</small>
                          <ArrowRight aria-hidden="true" />
                        </a>
                      </div>
                    </section>
                  )}
                </nav>

                <div className="mobile-menu-note">
                  <span>Made slowly</span>
                  <strong>In conversation with craft</strong>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <BrandMark />

          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions --
              closing on pointer-leave has no keyboard analogue; Escape and blur
              already close the menu. */}
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
            {/* The edits flagged for the nav, by their own names. These were
                hardcoded as "New in" and a "Sale" link into a filtered saree
                listing, so the desktop nav disagreed with the mobile one and
                ignored the database flag that is supposed to decide this. */}
            {collections.map((collection) => (
              <div className="nav-item" key={collection.id}>
                <Link href={`/collections/${collection.slug}`}>
                  {collection.name}
                </Link>
              </div>
            ))}
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
              {searchOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Search aria-hidden="true" />
              )}
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
              data-bag-target
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
            <div className="search-drawer-inner">
              <label htmlFor="site-search">Find your next favourite</label>

              <div className="search-field">
                <Search aria-hidden="true" />
                <input
                  id="site-search"
                  ref={focusOnOpen}
                  name="q"
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder={
                    suggestions.length > 0
                      ? `Search ${suggestions[hint % suggestions.length].toLowerCase()}…`
                      : 'Search the shop…'
                  }
                  type="search"
                  value={term}
                />
                <Button className="search-submit" type="submit">
                  Search
                </Button>
              </div>

              {suggestions.length > 0 && (
                <div className="search-quick">
                  <span>Try</span>
                  <div className="search-quick-list">
                    {suggestions.slice(0, 6).map((suggestion) => (
                      <Link
                        href={`/search?q=${encodeURIComponent(suggestion)}`}
                        key={suggestion}
                      >
                        {suggestion}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
