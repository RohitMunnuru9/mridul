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
    let last = -1;

    /*
     * Where the scene sits and how tall it is only change when the page is
     * laid out, so they are measured then rather than on every frame. Calling
     * getBoundingClientRect() inside a scroll handler forces the browser to
     * recompute layout before it can answer — sixty times a second, while it
     * is also trying to composite the animation those numbers drive. On a slow
     * phone that is the difference between this hero gliding and juddering.
     */
    let top = 0;
    let travel = 1;
    const measure = () => {
      const box = section.getBoundingClientRect();
      top = box.top + window.scrollY;
      travel = Math.max(1, box.height - window.innerHeight);
    };

    const paint = () => {
      frame = 0;
      const progress = reduced.matches
        ? 0
        : Math.max(0, Math.min(1, (window.scrollY - top) / travel));
      // Three decimals is finer than any of these transforms can show. Below
      // that, writing the variable only costs a style recalculation for a
      // frame that would have looked identical.
      const stepped = Math.round(progress * 1000) / 1000;
      if (stepped === last) return;
      last = stepped;
      section.style.setProperty('--progress', String(stepped));
    };

    const update = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const relayout = () => {
      measure();
      last = -1;
      update();
    };

    measure();
    paint();

    /*
     * Measuring once would be wrong the moment anything above the hero changes
     * height — the header publishes its own height after it mounts, and a web
     * font landing reflows the page under it. The old code got away with it by
     * re-measuring every frame; this watches for the two things that can
     * actually move the scene instead, which costs nothing while nothing does.
     */
    const observer = new ResizeObserver(relayout);
    observer.observe(section);
    window.addEventListener('load', relayout);
    document.fonts?.ready.then(relayout).catch(() => {});

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', relayout);
    reduced.addEventListener('change', relayout);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('load', relayout);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', relayout);
      reduced.removeEventListener('change', relayout);
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
              src="/images/saree-homepage-hero.webp"
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
              src="/images/saree-homepage-hero.webp"
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
