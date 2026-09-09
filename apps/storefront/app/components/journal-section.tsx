import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { JournalPost } from '@mridul/types';
import { Botanical } from './botanical';

/**
 * The journal: one story leads as a photographic banner, the rest follow as
 * tall illustrated panels.
 *
 * Three identical photo cards was the previous shape, and with seven
 * photographs on the whole site it meant the same pictures again beneath the
 * same pictures. Only the lead story carries a photograph now; the others are
 * blush and cream panels with a line drawing, which is where the reference
 * gets its look and which costs no photography at all.
 */
export function JournalSection({ posts }: { posts: JournalPost[] }) {
  if (posts.length === 0) return null;
  const [lead, ...rest] = posts;

  return (
    <section className="journal-editorial" aria-labelledby="journal-title">
      <header className="journal-editorial-head">
        <div>
          <p>Notes from our world</p>
          <h2 id="journal-title">The style journal</h2>
        </div>
        <Link href="/shop">
          View all <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <Link className="journal-lead" href={lead.href}>
        <div className="journal-lead-copy">
          <p className="journal-eyebrow">Read the story</p>
          <h3>{lead.title}</h3>
          <p className="journal-excerpt">{lead.excerpt}</p>
          <span className="journal-more">
            Read our journal <ArrowRight aria-hidden="true" />
          </span>
        </div>
        <div className="journal-lead-photo">
          <Image
            src={lead.media.url}
            alt={lead.media.alt}
            fill
            sizes="(max-width: 860px) 100vw, 60vw"
            style={{ objectPosition: lead.media.focal }}
          />
        </div>
      </Link>

      {rest.length > 0 && (
        <div className="journal-bookmarks">
          {rest.map((post, index) => {
            const blush = index % 2 === 0;
            return (
              <Link
                className={`journal-bookmark ${blush ? 'is-blush' : 'is-cream'}`}
                href={post.href}
                key={post.id}
              >
                <Botanical variant={blush ? 'bloom' : 'sprig'} />
                <p className="journal-eyebrow">Read the story</p>
                <span className="journal-rule" aria-hidden="true" />
                <h3>{post.title}</h3>
                <p className="journal-excerpt">{post.excerpt}</p>
                <span className="journal-arrow" aria-hidden="true">
                  <ArrowRight />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
