import Link from 'next/link';
import { ArrowRight, Flower2 } from 'lucide-react';
import type { OccasionPanel } from '@mridul/types';

/** Three curated panels. Copy and destinations come from the content layer. */
export function OccasionEdit({ panels }: { panels: OccasionPanel[] }) {
  if (panels.length === 0) return null;

  return (
    <section className="occasion-section" id="occasions" aria-label="Curated edits">
      {panels.map((panel) => (
        <article className={`occasion-${panel.tone}`} key={panel.id}>
          {panel.tone === 'note' && <Flower2 aria-hidden="true" />}
          {panel.tone === 'visual' ? (
            <div>
              <p>{panel.eyebrow}</p>
              <h2>{panel.title}</h2>
              <Link href={panel.ctaHref}>
                {panel.ctaLabel} <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <p>{panel.eyebrow}</p>
              <h2>{panel.title}</h2>
              {panel.body && <p className="occasion-body">{panel.body}</p>}
              <Link href={panel.ctaHref}>
                {panel.ctaLabel} <ArrowRight aria-hidden="true" />
              </Link>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
