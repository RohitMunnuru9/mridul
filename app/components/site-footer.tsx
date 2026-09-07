'use client';

import { useState } from 'react';
import { ArrowRight, Camera, Flower2, Play } from 'lucide-react';
import { BrandMark } from './brand-mark';
import { Button } from '@/components/ui/button';

export function SiteFooter() {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="site-footer" id="footer">
      <div className="newsletter-panel">
        <div>
          <span>Letters from Mridul</span>
          <h2>New drapes, old stories, thoughtful notes.</h2>
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
            <label className="sr-only" htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" type="email" placeholder="Your email address" required />
            <Button type="submit" size="icon-lg" aria-label="Join the newsletter">
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>
        )}
      </div>

      <div className="footer-grid">
        <div className="footer-brand">
          <BrandMark />
          <p>Timeless weaves. Thoughtful choices. Made for your life.</p>
          <div className="social-links">
            <a href="#top" aria-label="Instagram"><Camera aria-hidden="true" /></a>
            <a href="#top" aria-label="YouTube"><Play aria-hidden="true" /></a>
          </div>
        </div>
        <div>
          <h3>Shop</h3>
          <a href="#new-arrivals">New arrivals</a>
          <a href="#sarees">Sarees</a>
          <a href="#categories">Ready to wear</a>
          <a href="#occasions">Occasion edit</a>
        </div>
        <div>
          <h3>Help</h3>
          <a href="#top">Track order</a>
          <a href="#top">Shipping & returns</a>
          <a href="#top">Care guide</a>
          <a href="#top">Contact us</a>
        </div>
        <div>
          <h3>About</h3>
          <a href="#story">Our story</a>
          <a href="#story">Our craft</a>
          <a href="#story">Artisan partners</a>
          <a href="#top">Journal</a>
        </div>
        <blockquote>
          <Flower2 aria-hidden="true" strokeWidth={1} />
          “Beautiful things take time—and become part of yours.”
        </blockquote>
      </div>

      <div className="footer-bottom">
        <p>© 2026 Mridul by MR. All rights reserved.</p>
        <div><a href="#top">Privacy</a><a href="#top">Terms</a></div>
      </div>
    </footer>
  );
}
