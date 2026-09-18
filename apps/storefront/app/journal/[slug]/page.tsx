/**
 * One story.
 *
 * The body is the writer's words, rendered as text — paragraphs split on blank
 * lines, nothing interpreted. What was pasted into the admin is what appears,
 * and nothing pasted can become markup.
 *
 * A draft is a 404 here regardless of who is looking. The admin has its own
 * preview of the text; a draft's address should not work before it is meant
 * to, even for the person who wrote it, or it gets shared early.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ChevronRight } from 'lucide-react';
import {
  getJournalPost,
  getJournalPosts,
  hasStory,
  paragraphs,
  readingMinutes,
} from '@mridul/database';
import { formatDate, imageAtWidth } from '@mridul/utils';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await getJournalPosts();
  return posts.filter(hasStory).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getJournalPost(slug);
  if (!post || !hasStory(post)) return { title: 'Not found | Mridul by MR' };

  return {
    title: `${post.title} | Mridul by MR`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      images: [{ url: post.media.url, alt: post.media.alt }],
    },
  };
}

export default async function StoryPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getJournalPost(slug);
  // A post with no story yet has nothing to show here; its link goes to a
  // listing instead, so this address should not exist for it either.
  if (!post || !hasStory(post)) notFound();

  const body = paragraphs(post.body);
  const shopLink = post.href && post.href !== '/' ? post.href : null;

  return (
    <article className="story-page page-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <Link href="/journal">Journal</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">{post.title}</span>
      </nav>

      <header className="story-head">
        <p className="eyebrow">
          {post.publishedAt ? formatDate(post.publishedAt) : 'From the journal'} ·{' '}
          {readingMinutes(post.body)} min read
        </p>
        <h1>{post.title}</h1>
        <p className="story-standfirst">{post.excerpt}</p>
      </header>

      <div className="story-hero">
        <Image
          alt={post.media.alt}
          fill
          priority
          sizes="(max-width: 900px) 100vw, 900px"
          src={imageAtWidth(post.media.url, 1600)}
          style={{ objectPosition: post.media.focal }}
        />
      </div>

      <div className="story-text">
        {body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      {shopLink && (
        <Link className="story-shop" href={shopLink}>
          Shop the pieces from this story <ArrowRight aria-hidden="true" />
        </Link>
      )}

      <Link className="story-back" href="/journal">
        More from the journal
      </Link>
    </article>
  );
}
