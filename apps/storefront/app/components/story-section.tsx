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
import type { StoryPanel, ValueIcon, ValueProp } from '@mridul/types';

/** Icon keys are stored as data, so the map lives with the markup. */
const ICONS: Record<ValueIcon, LucideIcon> = {
  truck: Truck,
  returns: RefreshCcw,
  secure: ShieldCheck,
  artisans: HeartHandshake,
};

export function StorySection({
  panel,
  values,
}: {
  panel: StoryPanel;
  values: ValueProp[];
}) {
  return (
    <>
      <section className="story-section" id="story" aria-labelledby="story-title">
        <div className="story-image">
          <Image
            fill
            sizes="(max-width: 860px) 100vw, 55vw"
            src={panel.media.url}
            alt={panel.media.alt}
            style={{ objectPosition: panel.media.focal }}
          />
        </div>
        <div className="story-copy">
          <p>{panel.eyebrow}</p>
          <h2 id="story-title">{panel.title}</h2>
          <p className="story-body">{panel.body}</p>
          <div className="story-stats">
            {panel.stats.map((stat) => (
              <span key={stat.label}>
                <strong>{stat.value}</strong> {stat.label}
              </span>
            ))}
          </div>
          <Link href={panel.ctaHref}>
            {panel.ctaLabel} <ArrowRight aria-hidden="true" />
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
