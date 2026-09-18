'use server';

/**
 * Answering a return.
 *
 * Approve, decline, or record the refund. The stock movement, the "only if
 * everything came back" rule for the order's status, and the running refund
 * total all live in `admin_decide_return`, so the admin cannot get them
 * subtly wrong. This turns a form into a call and a refusal into a sentence.
 */

import { revalidatePath } from 'next/cache';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';
import { audit } from './audit';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

function toPaise(raw: string): number | null {
  const cleaned = raw.replace(/[,\s₹]/g, '');
  if (cleaned === '') return null;
  const rupees = Number(cleaned);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  return Math.round(rupees * 100);
}

export async function decideReturn(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, 'order_manager')) return FAIL('You cannot decide returns.');

  const requestId = String(formData.get('request_id') ?? '');
  const orderId = String(formData.get('order_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const staffNote = String(formData.get('staff_note') ?? '').trim();
  const refund = decision === 'refund' ? toPaise(String(formData.get('refund') ?? '')) : null;

  if (!requestId) return FAIL('That return could not be found.');
  if (!['approve', 'decline', 'refund'].includes(decision)) {
    return FAIL('A return is approved, declined or refunded.');
  }
  if (decision === 'refund' && refund === null) {
    return FAIL('Enter the amount refunded, in rupees.');
  }

  const db = await sessionClient();
  const { data, error } = await db.rpc('admin_decide_return', {
    p_request_id: requestId,
    p_decision: decision,
    p_staff_note: staffNote || null,
    p_refund: refund,
  });

  if (error) {
    if (error.code === 'PGRST202') {
      return FAIL('Returns are not set up on this database yet — migration 0024 has not been run.');
    }
    return FAIL(error.code === 'P0001' ? error.message : 'That could not be saved just now.');
  }

  await audit(`return.${decision}`, 'return', requestId, null, {
    order_id: orderId,
    ...(refund !== null ? { refund_paise: refund } : {}),
    ...(staffNote ? { note: staffNote } : {}),
  });

  revalidatePath('/orders');
  if (orderId) revalidatePath(`/orders/${orderId}`);

  const result = (data ?? {}) as { restocked?: number; order_returned?: boolean };
  if (decision === 'approve') {
    return OK(
      `Approved. ${result.restocked ?? 0} back into stock${
        result.order_returned ? ' — the whole order is now marked returned' : ''
      }.`,
    );
  }
  if (decision === 'decline') return OK('Declined. The customer can see your reason.');
  return OK('Refund recorded.');
}
