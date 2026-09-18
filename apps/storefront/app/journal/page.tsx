/**
 * The journal — every published story.
 *
 * The homepage has said "Read our journal" and "View all" since the shop
 * opened, and both went to the shop listing. This is where they go now.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getJournalPosts, hasStory, journalHref, readingMinutes } from '@mridul/database';
import { formatDate, imageAtWidth } from '@mridul/utils';

export const metadata: Metadata = {
  title: 'The style journal | Mridul by MR',
  description:
    'Notes from our world — on draping, blouses, festive dressing and the sarees themselves.',
};

export default async function JournalPage() {
  const posts = await getJournalPosts();

  return (
    <div className="journal-page page-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Journal</span>
      </nav>

      <header className="journal-page-head">
        <p className="eyebrow">Notes from our world</p>
        <h1>The style journal</h1>
      </header>

      {posts.length === 0 ? (
        <p className="journal-page-empty">Nothing written yet. Come back soon.</p>
      ) : (
        <ul className="jnl-grid">
          {posts.map((post) => (
            <li className="jnl-card" key={post.id}>
              <Link href={journalHref(post)}>
                <span className="jnl-card-photo">
                  <Image
                    alt={post.media.alt}
                    fill
                    sizes="(max-width: 700px) 100vw, 33vw"
                    src={imageAtWidth(post.media.url, 900)}
                    style={{ objectPosition: post.media.focal }}
                  />
                </span>
                <span className="jnl-card-body">
                  <span className="jnl-card-meta">
                    {post.publishedAt ? formatDate(post.publishedAt) : ''}
                    {hasStory(post) ? ` · ${readingMinutes(post.body)} min read` : ''}
                  </span>
                  <strong>{post.title}</strong>
                  <span className="jnl-card-excerpt">{post.excerpt}</span>
                  <span className="jnl-card-more">
                    {hasStory(post) ? 'Read the story' : 'See the pieces'}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
