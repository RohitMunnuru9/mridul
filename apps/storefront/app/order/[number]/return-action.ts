'use server';

/**
 * The customer asks for a return.
 *
 * This shapes the form and passes it on. Whether they may — their own order,
 * delivered, inside the window, pieces that are actually on it — is decided
 * by `request_return` in the database, where the browser cannot argue with it.
 */

import { revalidatePath } from 'next/cache';
import { sessionClient } from '@mridul/supabase/server';

export type ReturnResult = { ok: true; message: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requestReturn(
  orderId: string,
  orderNumber: string,
  formData: FormData,
): Promise<ReturnResult> {
  if (!UUID.test(orderId)) return { ok: false, message: 'That order could not be found.' };

  // Each chosen line arrives as `item:<order item id>` = quantity.
  const items: { order_item_id: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('item:')) continue;
    const id = key.slice('item:'.length);
    const quantity = Number.parseInt(String(value), 10);
    if (!UUID.test(id) || !Number.isFinite(quantity) || quantity < 1) continue;
    items.push({ order_item_id: id, quantity });
  }
  if (items.length === 0) {
    return { ok: false, message: 'Tick at least one piece to send back.' };
  }

  const reason = String(formData.get('reason') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();

  const db = await sessionClient();
  const { error } = await db.rpc('request_return', {
    p_order_id: orderId,
    p_items: items,
    p_reason: reason,
    p_note: note || null,
  });

  if (error) {
    // The function's own refusals are already sentences a customer can act
    // on. Anything else is ours to explain, not theirs to decode.
    return {
      ok: false,
      message:
        error.code === 'P0001'
          ? error.message
          : 'That could not be sent just now. Please try again in a moment.',
    };
  }

  revalidatePath(`/order/${orderNumber}`);
  return { ok: true, message: 'Sent. We will look at it and reply on this page.' };
}
