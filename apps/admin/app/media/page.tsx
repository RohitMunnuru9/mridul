/**
 * Media library.
 *
 * Every image the project uses, in one place: product shots, category headers,
 * the homepage hero banners, journal cards and the story panel. Each file is
 * listed once with every reference to it, so before anyone swaps or deletes an
 * image they can see exactly what it is doing and where.
 */

import type { Metadata } from 'next';
import { getMediaLibrary, getMediaSummary } from '@mridul/database';
import { MediaThumb, PageHead, Panel, StatCard, ViewOnSite } from '../components/ui';

export const metadata: Metadata = { title: 'Media | Mridul Admin' };

/** Which Supabase Storage bucket each file will live in. */
const BUCKET_NOTE: Record<string, string> = {
  products: 'Product photography',
  collections: 'Category and collection headers',
  banners: 'Homepage hero banners',
  homepage: 'Editorial and story imagery',
  media: 'Everything else',
};

export default async function MediaPage() {
  const [library, summary] = await Promise.all([getMediaLibrary(), getMediaSummary()]);

  return (
    <>
      <PageHead
        title="Media"
        subtitle="Every image on the storefront, and everywhere each one is used."
      />

      <dl className="stat-grid">
        <StatCard label="Files" value={summary.files} note="unique files" />
        <StatCard
          label="References"
          value={summary.references}
          note="places they appear"
        />
        {summary.buckets.map((bucket) => (
          <StatCard
            key={bucket.bucket}
            label={bucket.bucket}
            value={bucket.files}
            note={BUCKET_NOTE[bucket.bucket] ?? ''}
          />
        ))}
      </dl>

      <Panel
        title="Library"
        note="Placeholder art is deliberately reused across several products, so one file can carry many references. Replacing a file changes every place listed against it."
      >
        <ul className="media-grid">
          {library.map((record) => (
            <li className="media-card" key={record.url}>
              <div className="media-card-preview">
                <MediaThumb
                  url={record.url}
                  alt={record.alt}
                  focal={record.focal}
                  size={132}
                />
              </div>
              <div className="media-card-body">
                <div className="media-card-head">
                  <code>{record.url}</code>
                  {record.buckets.map((bucket) => (
                    <span className={`pill bucket-${bucket}`} key={bucket}>
                      {bucket}
                    </span>
                  ))}
                </div>
                <p className="media-alt">
                  <strong>Alt:</strong> {record.alt}
                </p>
                <p className="media-meta">
                  <strong>Crop:</strong> <code>{record.focal}</code> ·{' '}
                  <strong>{record.usages.length}</strong>{' '}
                  {record.usages.length === 1 ? 'reference' : 'references'}
                </p>
                <ul className="media-usages">
                  {record.usages.map((usage, index) => (
                    <li key={`${usage.kind}-${usage.label}-${index}`}>
                      <span className="usage-kind">{usage.kind}</span>
                      <span className="usage-label">{usage.label}</span>
                      {usage.href && <ViewOnSite href={usage.href} />}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Uploading" note="What changes when Supabase Storage is connected.">
        <div className="prose">
          <p>
            Files are served from <code>/public</code> today, which means adding one
            is a code change. Once the storage buckets exist, this page gains an
            upload control per bucket and each row becomes editable: replace the
            file, rewrite the alt text, or drag the crop.
          </p>
          <p>
            Alt text is stored alongside every asset rather than written into a
            component, so it can be corrected without a deploy — the single most
            common accessibility fix on a catalogue this size.
          </p>
        </div>
      </Panel>
    </>
  );
}
