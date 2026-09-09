import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { JournalPost } from '@mridul/types';

/**
 * The journal: one story, as a photographic banner.
 *
 * It was three photo cards, then a banner plus two illustrated panels. The
 * panels have gone — the customer reviews above them now carry the blush and
 * cream treatment, and repeating it twice in a row made the bottom of the page
 * read as one long texture. One story, linked, with View all beside the
 * heading for the rest.
 */
export function JournalSection({ posts }: { posts: JournalPost[] }) {
  if (posts.length === 0) return null;
  const [lead] = posts;

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

    </section>
  );
}
