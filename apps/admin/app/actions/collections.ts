'use server';

/**
 * Which pieces belong to which collection.
 *
 * A collection is a merchandising decision — what the homepage rail shows,
 * what the Shop tab groups together — so moving a saree from New Arrivals to
 * Festive is something the shop does, not something a deploy does.
 *
 * Membership lives in `product_collections`, and `product_collections_staff_write`
 * in 0003 already decides who may change it: catalog and content managers, and
 * super_admin through them. These actions run under the editor's own session,
 * so that policy is the real gate and the role check below is only there to
 * turn a refusal into a sentence instead of a silent no-op.
 */

import { revalidatePath } from 'next/cache';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function editor() {
  const admin = await currentAdmin();
  return can(admin, 'catalog_manager', 'content_manager') ? admin : null;
}

/**
 * Put a piece into a collection, optionally taking it out of another.
 *
 * The insert happens before the removal on purpose. If the second half fails,
 * the piece is in both collections — visible twice, which somebody will notice
 * and can undo. The other order risks it being in neither, which looks exactly
 * like it was never there.
 */
export async function moveProductToCollection(
  productId: string,
  fromCollectionId: string | null,
  toCollectionId: string,
): Promise<ActionResult> {
  if (!(await editor())) return FAIL('You cannot change collections.');

  if (!UUID.test(productId) || !UUID.test(toCollectionId)) {
    return FAIL('That piece could not be identified.');
  }
  if (fromCollectionId && !UUID.test(fromCollectionId)) {
    return FAIL('That collection could not be identified.');
  }
  if (fromCollectionId === toCollectionId) return OK('Already there.');

  const db = await sessionClient();

  const added = await db
    .from('product_collections')
    .upsert(
      { product_id: productId, collection_id: toCollectionId, position: 0 },
      { onConflict: 'product_id,collection_id', ignoreDuplicates: true },
    );
  if (added.error) return FAIL(added.error.message);

  if (fromCollectionId) {
    const removed = await db
      .from('product_collections')
      .delete()
      .eq('product_id', productId)
      .eq('collection_id', fromCollectionId);
    if (removed.error) {
      return FAIL(
        `Added to the new collection, but could not remove it from the old one: ${removed.error.message}`,
      );
    }
  }

  revalidatePath('/collections');
  revalidatePath('/products');
  return OK(fromCollectionId ? 'Moved.' : 'Added.');
}

/** Take a piece out of a collection without putting it anywhere else. */
export async function removeProductFromCollection(
  productId: string,
  collectionId: string,
): Promise<ActionResult> {
  if (!(await editor())) return FAIL('You cannot change collections.');
  if (!UUID.test(productId) || !UUID.test(collectionId)) {
    return FAIL('That piece could not be identified.');
  }

  const db = await sessionClient();
  const { error } = await db
    .from('product_collections')
    .delete()
    .eq('product_id', productId)
    .eq('collection_id', collectionId);
  if (error) return FAIL(error.message);

  revalidatePath('/collections');
  revalidatePath('/products');
  return OK('Removed from the collection.');
}
