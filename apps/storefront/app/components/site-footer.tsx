'use client';

/**
 * Site footer.
 *
 * Shop and Collections are rendered from the catalogue, so the footer cannot
 * drift out of step with the header. Policy pages that do not exist yet are
 * rendered as plain text rather than as links, so nothing here leads to a 404.
 */

import { useState } from 'react';
import Link from 'next/link';
import { whatsappLink } from '@mridul/utils';
import { ArrowRight, Camera, Play } from 'lucide-react';
import { Botanical } from './botanical';
import { BrandMark } from './brand-mark';
import { Button } from '@/components/ui/button';
import type { Category, Collection, SiteSettings } from '@mridul/types';

export function SiteFooter({
  categories,
  collections,
  settings,
  copy,
}: {
  categories: Category[];
  collections: Collection[];
  settings: SiteSettings;
  copy: Record<string, string>;
}) {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="site-footer is-editorial" id="footer">
      <div className="newsletter-panel">
        <Botanical variant="sprig" />
        <div className="newsletter-copy">
          <span>Letters from Mridul</span>
          <h2>New drapes, old stories, thoughtful notes.</h2>
          <p>One letter a month. No noise, and you can leave whenever you like.</p>
        </div>
        {subscribed ? (
          <output className="newsletter-success">
            You&apos;re on the list. We&apos;ll write soon.
          </output>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubscribed(true);
            }}
          >
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="Your email address"
              required
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label="Join the newsletter"
            >
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>
        )}
      </div>

      <div className="footer-grid">
        <div className="footer-brand">
          <BrandMark />
          <p>{copy.footer_brand_line}</p>
          <div className="social-links">
            <a
              href={settings.contact.instagram}
              aria-label="Instagram"
              rel="noreferrer noopener"
              target="_blank"
            >
              <Camera aria-hidden="true" />
            </a>
            <a
              href={settings.contact.youtube}
              aria-label="YouTube"
              rel="noreferrer noopener"
              target="_blank"
            >
              <Play aria-hidden="true" />
            </a>
          </div>
        </div>

        <div>
          <h3>Shop</h3>
          {categories.map((category) => (
            <Link href={`/shop/${category.slug}`} key={category.id}>
              {category.name}
            </Link>
          ))}
          <Link href="/shop">Everything</Link>
          <Link href="/search">Search</Link>
        </div>

        <div>
          <h3>Edits</h3>
          {collections.map((collection) => (
            <Link href={`/collections/${collection.slug}`} key={collection.id}>
              {collection.name}
            </Link>
          ))}
        </div>

        <div>
          <h3>Your account</h3>
          <Link href="/account">Account</Link>
          <Link href="/bag">Bag</Link>
          <Link href="/wishlist">Wishlist</Link>
          {/* Nothing rather than a chat with a number nobody answers. It
              comes back by itself once Settings holds a real one. */}
          {whatsappLink(settings.contact.whatsapp) && (
            <a
              href={whatsappLink(settings.contact.whatsapp) ?? undefined}
              rel="noreferrer noopener"
              target="_blank"
            >
              Contact on WhatsApp
            </a>
          )}
        </div>

        <div>
          <h3>Help</h3>
          {/* Policy pages that do not exist yet: plain text, so nothing here
              leads to a 404 and the gap stays visible. */}
          {settings.pendingPolicies.map((page) => (
            <span className="footer-pending" key={page}>
              {page}
            </span>
          ))}
        </div>

      </div>

      <blockquote className="footer-quote">
        <Botanical variant="bloom" />
        <p>{copy.footer_quote}</p>
      </blockquote>

      <div className="footer-bottom">
        <p>© 2026 {settings.brandName}. All rights reserved.</p>
        <p className="footer-note">
          Policy pages arrive with the content module.
        </p>
      </div>
    </footer>
  );
}
