import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { JournalPost } from '@mridul/types';

export function JournalSection({ posts }: { posts: JournalPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="journal-section" aria-labelledby="journal-title">
      <div className="compact-section-heading">
        <div>
          <p>Notes from our world</p>
          <h2 id="journal-title">The style journal</h2>
        </div>
        <Link href="/shop">
          View all <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <div className="journal-grid">
        {posts.map((post) => (
          <Link className="journal-card" href={post.href} key={post.id}>
            <Image
              src={post.media.url}
              alt={post.media.alt}
              fill
              sizes="(max-width: 860px) 100vw, 33vw"
              style={{ objectPosition: post.media.focal }}
            />
            <span>Read the story</span>
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <ArrowRight aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
