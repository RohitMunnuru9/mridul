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
import { trackingUrlFor } from '@mridul/shipping';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

const STATUSES: OrderStatus[] = [...ORDER_PIPELINE, ...ORDER_EXITS];

/** PostgREST's code for "no such function": migration 0021 is not applied. */
const NOT_SET_UP = 'PGRST202';

/**
 * Turn a Postgres error into something the shop can act on.
 *
 * Anything the functions raise deliberately is already a sentence — "Tracking
 * number X is already on another order" — so it is passed through. A missing
 * function means the migration has not been run, which is a different problem
 * with a different fix, and saying "please try again" would send somebody
 * round in circles.
 */
function dispatchError(error: { code?: string; message: string }): ActionResult {
  if (error.code === NOT_SET_UP) {
    return FAIL('Dispatch is not set up on this database yet — migration 0021 has not been run.');
  }
  if (error.code === 'P0001') return FAIL(error.message);
  return FAIL('That could not be saved just now. Please try again.');
}

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


/* ---------------------------------------------------------------------------
 * Dispatch
 *
 * The shop types a courier and the number on the slip. Everything that could
 * go wrong with that — an unpaid order, a cancelled one, a tracking number
 * already on somebody else's parcel — is decided by `admin_record_dispatch`,
 * not here. This only shapes the input and turns a refusal into a sentence.
 * ------------------------------------------------------------------------- */

export async function recordDispatch(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'order_manager')) return FAIL('You cannot dispatch orders.');

  const id = String(formData.get('id') ?? '');
  const provider = String(formData.get('provider') ?? '').trim();
  const awb = String(formData.get('awb') ?? '').trim();
  const typed = String(formData.get('tracking_url') ?? '').trim();

  if (!id) return FAIL('That order could not be found.');
  if (!provider) return FAIL('Enter the courier’s name.');
  if (!awb) return FAIL('Enter the tracking number the courier gave you.');

  // A link the shop pasted wins over a built one: they are looking at the
  // courier's page and we are working from a template that may have moved.
  const trackingUrl = typed || trackingUrlFor(provider, awb) || null;

  const db = await sessionClient();
  const { error } = await db.rpc('admin_record_dispatch', {
    p_order_id: id,
    p_provider: provider,
    p_awb: awb,
    p_tracking_url: trackingUrl,
  });

  if (error) return dispatchError(error);

  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return OK(`Marked as shipped with ${provider}.`);
}

/** Closes the parcel's journey and the order together. */
export async function markDelivered(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'order_manager')) return FAIL('You cannot change orders.');

  const id = String(formData.get('id') ?? '');
  if (!id) return FAIL('That order could not be found.');

  const db = await sessionClient();
  const { error } = await db.rpc('admin_mark_delivered', { p_order_id: id });
  if (error) return dispatchError(error);

  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return OK('Marked as delivered.');
}
