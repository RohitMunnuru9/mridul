'use client';

/**
 * Homepage hero carousel.
 *
 * The slides arrive as props from the server. The image, the headline over it
 * and where the button goes are all rows an admin owns — this component only
 * knows how to move between them.
 */

import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HeroSlide } from '@mridul/types';

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  if (slides.length === 0) return null;

  const slide = slides[Math.min(active, slides.length - 1)];

  function move(direction: -1 | 1) {
    setActive((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Featured collections">
      <Image
        className="hero-image"
        src={slide.media.url}
        alt={slide.media.alt}
        fill
        priority={active === 0}
        sizes="100vw"
        style={{ objectPosition: slide.media.focal }}
      />
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-copy" aria-live="polite">
        <p className="eyebrow">{slide.eyebrow}</p>
        <h1>{slide.title}</h1>
        <p className="hero-intro">{slide.note}</p>
        <Link className="primary-cta" href={slide.ctaHref}>
          {slide.ctaLabel}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      {slides.length > 1 && (
        <div className="hero-controls">
          <Button variant="ghost" size="icon" aria-label="Previous collection" onClick={() => move(-1)}>
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="hero-dots" aria-label="Choose featured collection">
            {slides.map((item, index) => (
              <button
                aria-label={`Show ${item.title}`}
                aria-current={index === active ? 'true' : undefined}
                className={index === active ? 'is-active' : undefined}
                key={item.id}
                onClick={() => setActive(index)}
                type="button"
              />
            ))}
          </div>
          <Button variant="ghost" size="icon" aria-label="Next collection" onClick={() => move(1)}>
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  );
}
