'use server';

/**
 * Content edits: the hero banners, the homepage panel headings, the mood tiles
 * and the named prose blocks.
 *
 * These are the headings a customer actually reads, so they belong to whoever
 * writes the words rather than to whoever deploys the code.
 */

import { revalidatePath } from 'next/cache';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

async function requireContentRole() {
  const admin = await currentAdmin();
  return can(admin, 'content_manager') ? admin : null;
}

/** Hero banner copy and destination. The image is changed from Media. */
export async function updateHeroSlide(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const id = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return FAIL('A banner needs a headline.');

  const db = await sessionClient();
  const { error } = await db
    .from('hero_slides')
    .update({
      eyebrow: String(formData.get('eyebrow') ?? '').trim(),
      title,
      note: String(formData.get('note') ?? '').trim(),
      cta_label: String(formData.get('cta_label') ?? '').trim(),
      cta_href: String(formData.get('cta_href') ?? '/').trim() || '/',
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', id);

  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  return OK('Banner saved.');
}

/**
 * Add a customer review.
 *
 * Created unpublished. A testimonial names a real person, so it reaches the
 * storefront only when someone deliberately publishes it — never by being
 * seeded or by being typed in half.
 */
export async function createTestimonial(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const author = String(formData.get('author') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const rating = Number(formData.get('rating') ?? 5);
  if (!author) return FAIL('Whose review is this?');
  if (body.length < 10) return FAIL('Paste what the customer actually wrote.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return FAIL('Rating must be a whole number from 1 to 5.');
  }

  const db = await sessionClient();
  const { error } = await db.from('testimonials').insert({
    author,
    location: String(formData.get('location') ?? '').trim(),
    body,
    rating,
    position: Number(formData.get('position') ?? 0) || 0,
  });

  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  revalidatePath('/');
  return OK('Review saved as a draft. Publish it when you are ready.');
}

/** Edit a review, and publish or unpublish it. */
export async function updateTestimonial(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const id = String(formData.get('id') ?? '');
  const author = String(formData.get('author') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const rating = Number(formData.get('rating') ?? 5);
  if (!id) return FAIL('Missing review.');
  if (!author) return FAIL('Whose review is this?');
  if (body.length < 10) return FAIL('Paste what the customer actually wrote.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return FAIL('Rating must be a whole number from 1 to 5.');
  }

  const db = await sessionClient();
  const { error } = await db
    .from('testimonials')
    .update({
      author,
      location: String(formData.get('location') ?? '').trim(),
      body,
      rating,
      position: Number(formData.get('position') ?? 0) || 0,
      is_published: formData.get('is_published') === 'on',
    })
    .eq('id', id);

  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  revalidatePath('/');
  return OK('Review saved.');
}

/**
 * Publishes or unpublishes a review, and nothing else.
 *
 * The card carries two forms — one for the picture, one for the words — so a
 * Published tick inside the second only takes effect if you press *its* Save.
 * That is easy to get wrong and gives no sign it went wrong. This is its own
 * button doing one thing.
 */
export async function setTestimonialPublished(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const id = String(formData.get('id') ?? '');
  const published = formData.get('published') === 'true';
  if (!id) return FAIL('Missing review.');

  const db = await sessionClient();
  const { error } = await db
    .from('testimonials')
    .update({ is_published: published })
    .eq('id', id);
  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  revalidatePath('/');
  return OK(published ? 'Published — it is on the website now.' : 'Taken off the website.');
}

/** Removes a review outright. Unlike a product, there is nothing to archive. */
export async function deleteTestimonial(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const id = String(formData.get('id') ?? '');
  if (!id) return FAIL('Missing review.');

  const db = await sessionClient();
  const { error } = await db.from('testimonials').delete().eq('id', id);
  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  revalidatePath('/');
  return OK('Review removed.');
}

/** The three editorial panels between the tiles and the product rail. */
export async function updateOccasionPanel(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const id = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return FAIL('A panel needs a heading.');

  const db = await sessionClient();
  const { error } = await db
    .from('occasion_panels')
    .update({
      eyebrow: String(formData.get('eyebrow') ?? '').trim(),
      title,
      body: String(formData.get('body') ?? '').trim() || null,
      cta_label: String(formData.get('cta_label') ?? '').trim(),
      cta_href: String(formData.get('cta_href') ?? '/').trim() || '/',
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', id);

  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  return OK('Panel saved.');
}

/** A "shop by mood" tile: its label, note and where it points. */
export async function updateMoodTile(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return FAIL('A tile needs a label.');

  const db = await sessionClient();
  const { error } = await db
    .from('mood_tiles')
    .update({
      label,
      note: String(formData.get('note') ?? '').trim(),
      href: String(formData.get('href') ?? '/').trim() || '/',
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', id);

  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  return OK('Tile saved.');
}

/** Whether a section appears on the homepage, and in what order. */
export async function updateHomepageSection(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit the homepage.');

  const id = String(formData.get('id') ?? '');
  const position = Number.parseInt(String(formData.get('position') ?? ''), 10);

  const db = await sessionClient();
  const { error } = await db
    .from('homepage_sections')
    .update({
      is_enabled: formData.get('is_enabled') === 'on',
      position: Number.isFinite(position) ? position : 0,
    })
    .eq('id', id);

  if (error) return FAIL(error.message);

  revalidatePath('/homepage');
  return OK('Section saved.');
}

/** Named prose: the strapline, the footer lines, the product accordions. */
export async function updateContentBlock(formData: FormData): Promise<ActionResult> {
  if (!(await requireContentRole())) return FAIL('You cannot edit site copy.');

  const key = String(formData.get('key') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return FAIL('This block cannot be empty.');

  const db = await sessionClient();
  const { error } = await db.from('content_blocks').update({ body }).eq('key', key);
  if (error) return FAIL(error.message);

  revalidatePath('/settings');
  return OK('Copy saved.');
}

/** Category headings and the intro a shopper reads above the grid. */
export async function updateCategory(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'catalog_manager', 'content_manager')) {
    return FAIL('You cannot edit categories.');
  }

  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return FAIL('A category needs a name.');

  const db = await sessionClient();
  const { error } = await db
    .from('categories')
    .update({
      name,
      tagline: String(formData.get('tagline') ?? '').trim(),
      intro: String(formData.get('intro') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', id);

  if (error) return FAIL(error.message);

  revalidatePath('/categories');
  return OK('Category saved.');
}

/** Site-wide settings: the shipping figure, contact details, the quotes. */
export async function updateSettings(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin)) return FAIL('Only a super admin can change settings.');

  const threshold = Number(String(formData.get('free_shipping') ?? '').replace(/[,\s₹]/g, ''));
  const flat = Number(String(formData.get('flat_shipping') ?? '').replace(/[,\s₹]/g, ''));
  if (!Number.isFinite(threshold) || threshold < 0) return FAIL('Free shipping figure must be a number.');
  if (!Number.isFinite(flat) || flat < 0) return FAIL('Flat rate must be a number.');

  // One line per quote, empties dropped.
  const quotes = String(formData.get('quotes') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const db = await sessionClient();
  const { error } = await db
    .from('settings')
    .update({
      free_shipping_threshold_paise: Math.round(threshold * 100),
      flat_shipping_paise: Math.round(flat * 100),
      whatsapp_number: String(formData.get('whatsapp') ?? '').trim(),
      contact_email: String(formData.get('email') ?? '').trim(),
      quotes,
    })
    .eq('id', true);

  if (error) return FAIL(error.message);

  revalidatePath('/settings');
  return OK('Settings saved. The storefront picks these up immediately.');
}
