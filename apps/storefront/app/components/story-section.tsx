import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  HeartHandshake,
  RefreshCcw,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { ProductListItem, StoryPanel, ValueIcon, ValueProp } from '@mridul/types';
import { ProductCard } from './product-card';
import { Botanical } from './botanical';

/** Icon keys are stored as data, so the map lives with the markup. */
const ICONS: Record<ValueIcon, LucideIcon> = {
  truck: Truck,
  returns: RefreshCcw,
  secure: ShieldCheck,
  artisans: HeartHandshake,
};

/**
 * The brand story as a manifesto panel: photograph on one side, a cream panel
 * on the other with the eyebrow in tracked capitals, the title, the body set
 * as an italic passage, and the three figures beneath a short rule.
 *
 * The body is set in italic rather than inside quotation marks. It reads like
 * a quotation, but it is not one — nobody said it — and dressing it as one
 * would be a small lie.
 */
export function StorySection({
  panel,
  values,
  preview,
}: {
  panel: StoryPanel;
  values: ValueProp[];
  /** A collection to show beside the copy. Without one, the photograph stands. */
  preview?: { name: string; slug: string; products: ProductListItem[] };
}) {
  const showPreview = Boolean(preview && preview.products.length > 0);
  return (
    <>
      <section className="story-manifesto" id="story" aria-labelledby="story-title">
        {showPreview && preview ? (
          <div className="story-preview" aria-label={`${preview.name} preview`}>
            <div className="story-preview-head">
              <p className="story-eyebrow">{preview.name}</p>
              <Link href={`/collections/${preview.slug}`}>
                See all <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div className="story-preview-grid">
              {preview.products.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ) : (
          <div className="story-manifesto-photo">
            <Image
              fill
              sizes="(max-width: 860px) 100vw, 45vw"
              src={panel.media.url}
              alt={panel.media.alt}
              style={{ objectPosition: panel.media.focal }}
            />
          </div>
        )}

        <div className="story-manifesto-panel">
          <Botanical variant="bloom" />
          <p className="story-eyebrow">{panel.eyebrow}</p>
          <h2 id="story-title">{panel.title}</h2>
          <span className="story-rule" aria-hidden="true" />
          <p className="story-passage">{panel.body}</p>

          {panel.stats.length > 0 && (
            <dl className="story-figures">
              {panel.stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <Link className="story-cta" href={panel.ctaHref}>
            {panel.ctaLabel}
            <span className="story-cta-arrow">
              <ArrowRight aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      <section className="value-strip" aria-label="Shopping benefits">
        {values.map((value) => {
          const Icon = ICONS[value.icon];
          return (
            <div key={value.id}>
              <Icon aria-hidden="true" strokeWidth={1.25} />
              <span>
                <strong>{value.title}</strong>
                <small>{value.note}</small>
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}
