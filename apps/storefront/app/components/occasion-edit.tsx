import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Flower2 } from 'lucide-react';
import type { OccasionPanel } from '@mridul/types';

/** Three curated panels. Copy and destinations come from the content layer. */
export function OccasionEdit({ panels }: { panels: OccasionPanel[] }) {
  if (panels.length === 0) return null;

  return (
    <section
      className="curated-edits"
      id="occasions"
      aria-label="Curated edits"
    >
      <header className="curated-heading">
        <p>Thoughtfully put together</p>
        <h2>
          A little more <em>you.</em>
        </h2>
        <span>THE MRIDUL EDITS</span>
      </header>
      <div className="curated-layout">
        {panels.map((panel, index) => (
          <article
            className={`curated-card curated-${panel.tone}`}
            key={panel.id}
          >
            {panel.tone !== 'note' && (
              <div className="curated-photo">
                <Image
                  src={
                    panel.tone === 'visual'
                      ? '/images/products/drape-1.png'
                      : '/images/artisan-loom-story.png'
                  }
                  alt={
                    panel.tone === 'visual'
                      ? 'A delicate floral saree in soft sage green'
                      : 'An artisan weaving fabric on a traditional loom'
                  }
                  fill
                  sizes="(max-width: 720px) 90vw, 45vw"
                />
              </div>
            )}
            <div className="curated-copy">
              <div className="curated-marker">
                <span>0{index + 1} / THE EDIT</span>
                {panel.tone === 'note' && <Flower2 aria-hidden="true" />}
              </div>
              <p className="curated-eyebrow">{panel.eyebrow}</p>
              <h3>{panel.title}</h3>
              {panel.body && <p className="curated-body">{panel.body}</p>}
              <Link href={panel.ctaHref}>
                {panel.ctaLabel}
                <span className="curated-arrow">
                  <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
