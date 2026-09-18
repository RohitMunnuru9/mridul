'use server';

/**
 * Writing the journal.
 *
 * Every write runs under the editor's own session; `journal_posts_staff_write`
 * in 0004 lets a content manager (and so an owner) write and nobody else. The
 * role check here turns that refusal into a sentence.
 *
 * The body is stored as the plain text typed here and rendered as text on the
 * storefront. There is deliberately no markup: what a content manager pastes
 * cannot become a script on a page every visitor loads.
 */

import { revalidatePath } from 'next/cache';
import { slugify } from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

async function writer() {
  const admin = await currentAdmin();
  return can(admin, 'content_manager') ? admin : null;
}

function readable(message: string): string {
  if (/duplicate key|unique/i.test(message)) {
    return 'There is already a post at that address. Change the slug.';
  }
  if (/row-level security|permission denied/i.test(message)) {
    return 'Only a content manager can write the journal.';
  }
  return message;
}

type PostRow = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  href: string;
  position: number;
};

type Shaped = { ok: true; row: PostRow } | { ok: false; message: string };

function shape(formData: FormData): Shaped {
  const title = text(formData, 'title');
  if (title.length < 3) return { ok: false, message: 'Give the post a title.' };

  // A slug typed by hand wins; otherwise one is made from the title. Either
  // way it has to be an address a person could read out.
  const slug = (text(formData, 'slug') || slugify(title)).toLowerCase();
  if (!SLUG.test(slug)) {
    return {
      ok: false,
      message: 'The address can only have lowercase letters, numbers and hyphens.',
    };
  }

  const href = text(formData, 'href') || '/';
  // Shown as "shop the pieces from this story" and followed by a click, so it
  // stays inside the shop. An address on another site is a different thing.
  if (!href.startsWith('/') || href.startsWith('//')) {
    return {
      ok: false,
      message: 'The shop link has to start with a single / — a page on this site.',
    };
  }

  const position = Number.parseInt(text(formData, 'position') || '0', 10);

  return {
    ok: true,
    row: {
      slug,
      title,
      excerpt: text(formData, 'excerpt'),
      body: text(formData, 'body'),
      href,
      position: Number.isFinite(position) ? position : 0,
    },
  };
}

/** Every page the journal shows up on. */
function refresh() {
  revalidatePath('/journal');
  revalidatePath('/');
}

export async function createPost(formData: FormData): Promise<ActionResult> {
  if (!(await writer())) return FAIL('Only a content manager can write the journal.');

  const shaped = shape(formData);
  if (!shaped.ok) return FAIL(shaped.message);

  const db = await sessionClient();
  const { error } = await db.from('journal_posts').insert({ ...shaped.row, is_published: false });
  if (error) return FAIL(readable(error.message));

  refresh();
  return OK(`Saved as a draft at /journal/${shaped.row.slug}. Publish it when it is ready.`);
}

export async function updatePost(formData: FormData): Promise<ActionResult> {
  if (!(await writer())) return FAIL('Only a content manager can write the journal.');

  const id = text(formData, 'id');
  if (!id) return FAIL('That post could not be found.');

  const shaped = shape(formData);
  if (!shaped.ok) return FAIL(shaped.message);

  const db = await sessionClient();
  const { error } = await db.from('journal_posts').update(shaped.row).eq('id', id);
  if (error) return FAIL(readable(error.message));

  refresh();
  return OK('Saved.');
}

/**
 * Publish or take down.
 *
 * `published_at` is set the FIRST time and then left alone: a post edited a
 * year later still says when it was written, which is what a date on a story
 * is for.
 */
export async function setPostPublished(formData: FormData): Promise<ActionResult> {
  if (!(await writer())) return FAIL('Only a content manager can write the journal.');

  const id = text(formData, 'id');
  const publish = text(formData, 'published') === 'true';
  if (!id) return FAIL('That post could not be found.');

  const db = await sessionClient();
  const { data: current, error: readError } = await db
    .from('journal_posts')
    .select('published_at, body')
    .eq('id', id)
    .maybeSingle();
  if (readError) return FAIL(readable(readError.message));
  if (!current) return FAIL('That post could not be found.');

  const { error } = await db
    .from('journal_posts')
    .update({
      is_published: publish,
      published_at: publish
        ? (current.published_at ?? new Date().toISOString())
        : current.published_at,
    })
    .eq('id', id);
  if (error) return FAIL(readable(error.message));

  refresh();
  if (!publish) return OK('Taken down. Its address stops working straight away.');
  return OK(
    current.body?.trim()
      ? 'Published. The story is live.'
      : 'Published. It has no story yet, so it points at its shop link for now.',
  );
}

/**
 * Only a draft can be deleted. A published post is taken down instead, so an
 * address that was ever shared does not silently become a 404 with no trace.
 */
export async function deletePost(formData: FormData): Promise<ActionResult> {
  if (!(await writer())) return FAIL('Only a content manager can write the journal.');

  const id = text(formData, 'id');
  if (!id) return FAIL('That post could not be found.');

  const db = await sessionClient();
  const { error } = await db
    .from('journal_posts')
    .delete()
    .eq('id', id)
    .eq('is_published', false);
  if (error) return FAIL(readable(error.message));

  refresh();
  return OK('Draft deleted.');
}
