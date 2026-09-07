'use client';

import { useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, UserRound } from 'lucide-react';
import { BrandMark } from './brand-mark';
import { navigation } from '../catalog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const categoryLinks = ['Sarees', 'Lehengas', 'Kurtas', 'Blouses', 'Ready to Wear', 'Jewellery', 'Gifting'];

export function StorefrontHeader({ cartCount, wishlistCount }: { cartCount: number; wishlistCount: number }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <div className="announcement-bar">
        <span>Free shipping above ₹1,999</span><i />
        <span>Easy returns</span><i />
        <span>COD available</span>
        <span className="announcement-story">Wear a story. Not just clothing.</span>
      </div>
      <div className="navigation-stack">
        <header className="site-header">
          <div className="mobile-nav">
            <Sheet>
              <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open navigation" className="header-icon" />}>
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="left" className="mobile-menu-panel">
                <SheetHeader>
                  <SheetTitle><BrandMark /></SheetTitle>
                  <SheetDescription>Thoughtful drapes for every kind of day.</SheetDescription>
                </SheetHeader>
                <nav aria-label="Mobile navigation" className="mobile-links">
                  {navigation.map((item) => (
                    <a className={item.accent ? 'accent-link' : undefined} href={item.href} key={item.label}>
                      {item.label}<span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </nav>
                <div className="mobile-menu-note"><span>Made slowly</span><strong>In conversation with craft</strong></div>
              </SheetContent>
            </Sheet>
          </div>

          <BrandMark />

          <nav className="desktop-navigation" aria-label="Primary navigation">
            {navigation.map((item) => (
              <a className={item.accent ? 'accent-link' : undefined} href={item.href} key={item.label}>{item.label}</a>
            ))}
          </nav>

          <div className="header-actions">
            <Button variant="ghost" size="icon" className="header-icon" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}>
              <Search aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" className="header-icon desktop-action" aria-label="Your account"><UserRound aria-hidden="true" /></Button>
            <Button variant="ghost" size="icon" className="header-icon desktop-action" aria-label={`Wishlist, ${wishlistCount} items`}><Heart aria-hidden="true" /></Button>
            <Button variant="ghost" size="icon" className="header-icon bag-button" aria-label={`Shopping bag, ${cartCount} items`}>
              <ShoppingBag aria-hidden="true" /><span>{cartCount}</span>
            </Button>
          </div>
        </header>

        <nav className="mobile-category-nav" aria-label="Shop categories">
          {categoryLinks.map((label) => <a href={label === 'Sarees' ? '#new-arrivals' : '#categories'} key={label}>{label}</a>)}
        </nav>

        {searchOpen && (
          <form className="search-drawer" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="site-search">Find your next favourite</label>
            <div>
              <Search aria-hidden="true" />
              <input id="site-search" name="query" placeholder="Search sarees, blouses, fabrics…" type="search" />
              <Button type="submit" className="search-submit">Search</Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
