import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { Category, OccasionPanel } from '@mridul/types';
import { Botanical } from './botanical';

/**
 * Three curated panels. Copy and destinations come from the content layer.
 *
 * Only one of the three shows a photograph, and it is not chosen here: a panel
 * whose button leads into a category shows that category's own picture, so
 * changing the Sarees header in the admin changes this card too. The other two
 * are illustrated panels — blush and cream, with a line drawing — which is
 * both the look and a way of not repeating the same seven photographs again.
 */
export function OccasionEdit({
  panels,
  categories = [],
}: {
  panels: OccasionPanel[];
  /** Optional: without it the photo panel simply renders as an illustrated one. */
  categories?: Category[];
}) {
  if (panels.length === 0) return null;

  return (
    <section className="curated-edits" id="occasions" aria-label="Curated edits">
      <header className="curated-heading">
        <p>Thoughtfully put together</p>
        <h2>
          A little more <em>you.</em>
        </h2>
        <span>THE MRIDUL EDITS</span>
      </header>

      <div className="curated-layout">
        {panels.map((panel, index) => {
          const number = String(index + 1).padStart(2, '0');
          const photo = panel.tone === 'visual' ? photoFor(panel, categories) : null;

          return (
            <article
              className={`curated-card curated-${panel.tone}${photo ? ' has-photo' : ''}`}
              key={panel.id}
            >
              {photo && (
                <div className="curated-photo">
                  <Image
                    src={photo.url}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 720px) 100vw, 55vw"
                    style={{ objectPosition: photo.focal }}
                  />
                </div>
              )}

              {/* The drawing belongs to the tone, not the index, so an admin
                  reordering the panels keeps each one looking like itself. */}
              {panel.tone === 'note' && <Botanical variant="bloom" />}
              {panel.tone === 'impact' && <Botanical variant="sprig" />}
              {panel.tone === 'visual' && <Botanical variant="sprig" className="is-corner" />}

              <div className="curated-copy">
                <span className="curated-number" aria-hidden="true">
                  {number}
                </span>
                <p className="curated-eyebrow">{panel.eyebrow}</p>

                {panel.tone === 'impact' ? (
                  /* Set one word to a line in tracked capitals, the way the
                     reference stacks its words. It is the same title — only
                     the setting changes. */
                  <h3 className="curated-stacked">
                    {panel.title.trim().split(/\s+/).map((word, wordIndex) => (
                      <span key={`${word}-${wordIndex}`}>{word}</span>
                    ))}
                  </h3>
                ) : (
                  <h3>{panel.title}</h3>
                )}

                {panel.body && <p className="curated-body">{panel.body}</p>}

                <Link href={panel.ctaHref}>
                  {panel.ctaLabel}
                  <span className="curated-arrow">
                    <ArrowRight aria-hidden="true" />
                  </span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** The category a panel's button leads to, if it leads to one. */
function photoFor(panel: OccasionPanel, categories: Category[]) {
  const match = panel.ctaHref.match(/^\/shop\/([^/?#]+)/);
  if (!match) return null;
  return categories.find((category) => category.slug === match[1])?.heroImage ?? null;
}
