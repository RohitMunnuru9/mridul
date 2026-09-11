'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

export function CampaignHero() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const section = root.current?.querySelector<HTMLElement>('.campaign-scene');
    if (!section) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const paint = () => {
      frame = 0;
      const box = section.getBoundingClientRect();
      const progress = reduced.matches
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              -box.top / Math.max(1, box.height - window.innerHeight),
            ),
          );
      section.style.setProperty('--progress', String(progress));
    };
    const update = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    reduced.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      reduced.removeEventListener('change', update);
    };
  }, []);
  return (
    <div className="campaign-home" ref={root}>
      <section
        className="campaign-scene"
        data-scroll-scene="hero"
        aria-label="Wear a story campaign"
      >
        <div className="campaign-stage">
          <div className="campaign-photograph">
            <Image
              src="/images/saree-homepage-hero.png"
              alt="A woman in a floral ivory saree seated beside a sunlit window"
              fill
              priority
              sizes="100vw"
            />
          </div>
          <div className="campaign-shade" />
          <div className="campaign-kicker">
            <span>THE ART OF THE DRAPE</span>
            <span>INDIAN ROOTS. YOUR EXPRESSION.</span>
          </div>
          <h1 className="campaign-title">
            <span>WEAR</span>
            <span>A STORY.</span>
          </h1>
          <div className="campaign-subject" aria-hidden="true">
            <Image
              src="/images/saree-homepage-hero.png"
              alt=""
              fill
              priority
              sizes="100vw"
            />
          </div>
          <div className="campaign-bottom">
            <p>
              Not just worn.
              <br />
              <em>Felt.</em>
            </p>
            {/* The one thing this screen is for. It keeps `data-magnetic` so
                the cursor still pulls to it, but not `silk-link`: that is the
                quiet underlined link used elsewhere, and the primary action on
                the hero should not look like the rest of the page's links. */}
            <Link href="/shop/sarees" className="campaign-cta" data-magnetic>
              Explore the sarees <ArrowUpRight />
            </Link>
            <a href="#occasions" className="campaign-scroll">
              SCROLL TO UNFOLD <ArrowDown size={16} />
            </a>
          </div>
          <span className="campaign-side">
            MRIDUL BY MR — AN UNFOLDING STORY
          </span>
        </div>
      </section>
    </div>
  );
}
