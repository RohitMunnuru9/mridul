'use server';

/**
 * Admin writes.
 *
 * Every one of these runs through the signed-in user's session, so row-level
 * security decides whether the write lands. A content manager calling a
 * product update gets a database error, not a silent success — the UI hiding
 * a button is a convenience, not the control.
 *
 * Each action re-checks the role before touching anything. That is belt and
 * braces on purpose: the policy is the real gate, but failing early gives a
 * readable message instead of a raw Postgres error.
 */

import { revalidatePath } from 'next/cache';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';

export type ActionResult = { ok: boolean; message: string };

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

/** Rupees typed into a form become paise. Rejects anything not a number. */
function toPaise(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? '').trim().replace(/[,\s₹]/g, '');
  if (text === '') return null;
  const rupees = Number(text);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  return Math.round(rupees * 100);
}

function toInt(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? '').trim();
  if (text === '') return null;
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'catalog_manager')) return FAIL('You cannot edit products.');

  const id = String(formData.get('id') ?? '');
  if (!id) return FAIL('Missing product.');

  const pricePaise = toPaise(formData.get('price'));
  if (pricePaise === null) return FAIL('Price must be a number.');

  const compareRaw = String(formData.get('compare_at') ?? '').trim();
  const compareAtPaise = compareRaw === '' ? null : toPaise(formData.get('compare_at'));
  if (compareRaw !== '' && compareAtPaise === null) {
    return FAIL('Compare-at price must be a number.');
  }
  // The database enforces this too; catching it here gives a sentence rather
  // than a constraint violation.
  if (compareAtPaise !== null && compareAtPaise <= pricePaise) {
    return FAIL('Compare-at price must be higher than the price, or left empty.');
  }

  const db = await sessionClient();
  const { error } = await db
    .from('products')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      subtitle: String(formData.get('subtitle') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      blouse_details: String(formData.get('blouse_details') ?? '').trim() || null,
      fabric: String(formData.get('fabric') ?? '').trim(),
      colour_name: String(formData.get('colour_name') ?? '').trim(),
      occasion: String(formData.get('occasion') ?? '').trim(),
      technique: String(formData.get('technique') ?? '').trim(),
      price_paise: pricePaise,
      compare_at_paise: compareAtPaise,
      badge: (String(formData.get('badge') ?? '') || null) as never,
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', id);

  if (error) return FAIL(error.message);

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  return OK('Saved.');
}

/**
 * Stock, per variant.
 *
 * Set directly rather than adjusted by a delta: an admin correcting a count is
 * stating what is on the shelf, not describing a movement.
 */
export async function updateStock(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'catalog_manager')) return FAIL('You cannot change stock.');

  const variantId = String(formData.get('variant_id') ?? '');
  const onHand = toInt(formData.get('on_hand'));
  if (!variantId) return FAIL('Missing variant.');
  if (onHand === null) return FAIL('Stock must be a whole number, zero or more.');

  const db = await sessionClient();
  const { error } = await db
    .from('inventory')
    .update({ on_hand: onHand })
    .eq('variant_id', variantId);

  if (error) return FAIL(error.message);

  revalidatePath('/inventory');
  revalidatePath('/products');
  return OK(onHand === 0 ? 'Marked out of stock.' : `Stock set to ${onHand}.`);
}

/** Show or hide a product on the storefront without deleting anything. */
export async function toggleProductActive(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'catalog_manager')) return FAIL('You cannot edit products.');

  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  const db = await sessionClient();
  const { error } = await db.from('products').update({ is_active: active }).eq('id', id);
  if (error) return FAIL(error.message);

  revalidatePath('/products');
  return OK(active ? 'Product is live.' : 'Product hidden from the storefront.');
}

/**
 * Creates a product with one variant and no images.
 *
 * Starts inactive on purpose — a new row with no photography should never
 * appear on the storefront because someone clicked "add".
 */
export async function createProduct(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'catalog_manager')) return FAIL('You cannot add products.');

  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('category_id') ?? '');
  const pricePaise = toPaise(formData.get('price'));

  if (!name) return FAIL('Give the product a name.');
  if (!categoryId) return FAIL('Choose a category.');
  if (pricePaise === null) return FAIL('Price must be a number.');

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) return FAIL('That name cannot be turned into a web address.');

  const db = await sessionClient();

  const { data: product, error } = await db
    .from('products')
    .insert({
      slug,
      name,
      subtitle: String(formData.get('subtitle') ?? '').trim(),
      primary_category_id: categoryId,
      price_paise: pricePaise,
      is_active: false,
    })
    .select('id')
    .single();

  if (error) {
    return FAIL(
      error.code === '23505'
        ? 'A product with that name already exists.'
        : error.message,
    );
  }

  // One variant so the product is buyable the moment it is switched on.
  const { error: variantError } = await db.from('product_variants').insert({
    product_id: product.id,
    sku: `${slug.toUpperCase().slice(0, 12)}-01`,
    label: String(formData.get('variant_label') ?? 'Standard').trim() || 'Standard',
    price_delta_paise: 0,
    position: 0,
  });
  if (variantError) return FAIL(`Product created, but the variant failed: ${variantError.message}`);

  revalidatePath('/products');
  return OK('Created as a draft. Add images, then switch it live.');
}
