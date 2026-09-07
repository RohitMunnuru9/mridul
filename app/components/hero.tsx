'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

const slides = [
  {
    image: '/images/saree-homepage-hero.png',
    alt: 'Woman wearing an ivory botanical saree beside a heritage window',
    eyebrow: 'The Noor collection · 01',
    title: 'Tradition looks different here.',
    note: 'Timeless Indian wear, softened for the life you live now.',
    position: '66% center',
  },
  {
    image: '/images/saree-catalog-four-panel.png',
    alt: 'A softly lit edit of four contemporary sarees',
    eyebrow: 'The everyday edit · 02',
    title: 'Easy drapes. Lasting presence.',
    note: 'Handpicked textures that move beautifully from morning to evening.',
    position: '17% center',
  },
  {
    image: '/images/artisan-loom-story.png',
    alt: 'Artisan hands working rose and moss threads on a handloom',
    eyebrow: 'Made by hand · 03',
    title: 'A slower kind of beautiful.',
    note: 'Rooted in craft, considered in every detail, made to stay with you.',
    position: '58% center',
  },
];

export function Hero() {
  const [active, setActive] = useState(0);
  const slide = slides[active];

  function move(direction: -1 | 1) {
    setActive((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Featured collections">
      <Image
        className="hero-image"
        src={slide.image}
        alt={slide.alt}
        fill
        priority={active === 0}
        sizes="100vw"
        style={{ objectPosition: slide.position }}
      />
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-copy" aria-live="polite">
        <p className="eyebrow">{slide.eyebrow}</p>
        <h1>{slide.title}</h1>
        <p className="hero-intro">{slide.note}</p>
        <a className="primary-cta" href="#new-arrivals">
          Explore the collection
          <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
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
              key={item.title}
              onClick={() => setActive(index)}
              type="button"
            />
          ))}
        </div>
        <Button variant="ghost" size="icon" aria-label="Next collection" onClick={() => move(1)}>
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
