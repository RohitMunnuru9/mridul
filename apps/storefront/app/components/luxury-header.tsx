'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, ArrowRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { useStore } from '../providers/store-provider';

const links = [
  { label: 'NEW', href: '/collections/new-arrivals' },
  { label: 'SAREES', href: '/shop/sarees' },
  { label: 'COLLECTIONS', href: '/#occasions' },
  { label: 'THE HOUSE', href: '/#story' },
];
function Replacement({ children }: { children: string }) {
  return (
    <span className="replacement">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}
export function LuxuryHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount, wishlist } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 100);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return (
    <div
      className={`luxury-header${pathname === '/' ? ' is-home' : ''}${scrolled ? ' is-scrolled' : ''}`}
    >
      <header className="luxury-topline">
        <Sheet open={menu} onOpenChange={setMenu}>
          <SheetTrigger
            className="luxury-mobile-trigger"
            aria-label="Open navigation"
          >
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="luxury-menu">
            <SheetHeader>
              <SheetTitle>MRIDUL BY MR</SheetTitle>
              <SheetDescription>A story, waiting to unfold.</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile navigation">
              {links.map((link, index) => (
                <SheetClose key={link.href} render={<Link href={link.href} />}>
                  <small>0{index + 1}</small>
                  {link.label}
                </SheetClose>
              ))}
            </nav>
            <div className="luxury-menu-utility">
              {['account', 'wishlist', 'bag'].map((item) => (
                <SheetClose key={item} render={<Link href={`/${item}`} />}>
                  {item.toUpperCase()}
                </SheetClose>
              ))}
            </div>
          </SheetContent>
        </Sheet>
        <nav className="luxury-links" aria-label="Primary navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Replacement>{link.label}</Replacement>
            </Link>
          ))}
        </nav>
        <Link href="/" className="luxury-brand" aria-label="Mridul by MR home">
          MRIDUL<small>BY MR</small>
        </Link>
        <div className="luxury-actions">
          <button
            onClick={() => setSearch(!search)}
            aria-expanded={search}
            aria-label={search ? 'Close search' : 'Search'}
          >
            <Replacement>SEARCH</Replacement>
          </button>
          <Link className="luxury-account" href="/account">
            <Replacement>ACCOUNT</Replacement>
          </Link>
          <Link
            className="luxury-wishlist"
            href="/wishlist"
            aria-label={`Wishlist, ${wishlist.length} items`}
          >
            <Replacement>WISHLIST</Replacement>
          </Link>
          <Link
            className="luxury-bag"
            data-bag-target
            href="/bag"
            aria-label={`Shopping bag, ${cartCount} items`}
          >
            <Replacement>BAG</Replacement>
            <b>({cartCount})</b>
          </Link>
        </div>
      </header>
      {search && (
        <form
          className="luxury-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(
              new FormData(event.currentTarget).get('q') ?? '',
            ).trim();
            if (value) {
              setSearch(false);
              router.push(`/search?q=${encodeURIComponent(value)}`);
            }
          }}
        >
          <input
            ref={(node) => node?.focus()}
            name="q"
            aria-label="Search the collection"
            placeholder="A fabric, a feeling, a favourite…"
            type="search"
            required
          />
          <button aria-label="Submit search">
            <ArrowRight />
          </button>
        </form>
      )}
    </div>
  );
}
