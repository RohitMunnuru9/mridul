/**
 * The journal — the decisions, separate from the pages that draw them.
 *
 * A post has always been able to point at a listing (`href`). It can now also
 * carry a story of its own (`body`). Which of the two a link should lead to is
 * decided in one place, so the homepage, the index and the sitemap cannot
 * disagree about where "Read the story" goes.
 */

import type { JournalPost } from '@mridul/types';

/** Where a post takes people. The story if it has one; the listing if not. */
export function journalHref(post: Pick<JournalPost, 'slug' | 'body' | 'href'>): string {
  return post.body.trim() ? `/journal/${post.slug}` : post.href || '/';
}

/** Whether a post has a page of its own worth listing anywhere. */
export function hasStory(post: Pick<JournalPost, 'body'>): boolean {
  return post.body.trim().length > 0;
}

/**
 * Plain text to paragraphs: blank lines divide them, single line breaks are
 * kept inside one. No markup is interpreted — the body is the writer's words
 * and is rendered as text, so nothing pasted into it can become a script.
 */
export function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * A URL slug from a title. Lowercase, hyphens, nothing else — the kind of
 * address that survives being read aloud over the phone.
 */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Roughly how long the story takes to read, for the index card. */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
