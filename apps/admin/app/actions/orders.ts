'use server';

/**
 * Moving an order through the shop.
 *
 * Two different things happen here and they are deliberately not the same
 * call. A note is an ordinary column update, so it goes through the customer's
 * — here, the order manager's — own session and RLS decides whether it lands.
 * A status change also moves stock and can settle a payment, and neither of
 * those tables is writable by any client role, so it goes through
 * `admin_set_order_status`, which does all three in one transaction.
 *
 * Nothing in this file can change what an order cost. The money columns are
 * revoked from every client role in 0006 and stay that way.
 */

import { revalidatePath } from 'next/cache';
import { ORDER_EXITS, ORDER_PIPELINE, type OrderStatus } from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

const STATUSES: OrderStatus[] = [...ORDER_PIPELINE, ...ORDER_EXITS];

function isStatus(value: string): value is OrderStatus {
  return (STATUSES as string[]).includes(value);
}

export async function updateOrderStatus(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'order_manager')) return FAIL('You cannot change orders.');

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id) return FAIL('That order could not be found.');
  if (!isStatus(status)) return FAIL('That is not a status an order can be in.');

  const db = await sessionClient();
  const { error } = await db.rpc('admin_set_order_status', {
    p_order_id: id,
    p_status: status,
  });
  if (error) return FAIL(error.message);

  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return OK(`Marked as ${status.replace(/_/g, ' ')}.`);
}

/**
 * An internal note on the order — a courier reference, a phone call, why it
 * was held. Kept separate from the customer's own note, which is written once
 * at checkout and never edited here.
 */
export async function updateOrderNote(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'order_manager')) return FAIL('You cannot change orders.');

  const id = String(formData.get('id') ?? '');
  if (!id) return FAIL('That order could not be found.');

  const db = await sessionClient();
  const { error } = await db
    .from('orders')
    .update({ staff_notes: String(formData.get('staff_notes') ?? '').trim() || null })
    .eq('id', id);
  if (error) return FAIL(error.message);

  revalidatePath(`/orders/${id}`);
  return OK('Note saved.');
}
