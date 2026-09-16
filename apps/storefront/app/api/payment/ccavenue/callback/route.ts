/**
 * Where CCAvenue sends the customer back to.
 *
 * ---------------------------------------------------------------------------
 * Read this before changing anything here
 *
 * This request arrives as a cross-site form POST, made by the customer's own
 * browser, from ccavenue.com. Three things follow from that, and all three are
 * the reason this file is shaped the way it is.
 *
 * 1. NO SESSION. The Supabase auth cookie is SameSite=Lax, so it is not sent
 *    on a cross-site POST. There is no signed-in user on this request and
 *    there cannot be one. Everything below therefore runs with the service
 *    role, which is why this route is the only place in either app that holds
 *    it, and why it may never read anything from the request to decide who
 *    something belongs to.
 *
 * 2. THE BODY IS NOT EVIDENCE. It travelled through a machine the customer
 *    controls. It is decrypted only to learn *which order* is being talked
 *    about. Whether that order was paid is then asked of CCAvenue directly,
 *    over our own connection, in `fetchOrderStatus`. If those two disagree,
 *    the one that did not come through the customer's browser wins.
 *
 * 3. IT MAY ARRIVE TWICE, OR NEVER. Both are ordinary. `confirm_online_payment`
 *    and `fail_online_payment` are idempotent and refuse to act on an order
 *    that has moved on, so a replay changes nothing. An order that never comes
 *    back stays `pending_payment` with its stock held, which is a state the
 *    shop can see and settle.
 *
 * The amount is checked twice over: once here against the order row, and again
 * inside `confirm_online_payment`, which raises rather than confirm an order
 * whose total disagrees with what was paid.
 */

import { NextResponse } from 'next/server';
import { adminClient } from '@mridul/supabase';
import {
  ccavenueConfig,
  fetchOrderStatus,
  readRedirect,
} from '@mridul/payments/ccavenue';

/** A POST cannot be answered with 307 — the browser would repeat it at the
 *  destination. 303 is what turns this back into an ordinary page view. */
const SEE_OTHER = 303;

function back(origin: string, path: string) {
  return NextResponse.redirect(new URL(path, origin), SEE_OTHER);
}

export async function POST(request: Request) {
  const origin =
    process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? new URL(request.url).origin;

  let encResp = '';
  try {
    const form = await request.formData();
    encResp = String(form.get('encResp') ?? form.get('enc_response') ?? '');
  } catch {
    return back(origin, '/account?payment=unreadable');
  }

  if (!encResp) {
    // CCAvenue sends nothing back when the customer abandons the page before
    // a transaction exists. There is no order to fail, only somebody to send
    // somewhere sensible.
    return back(origin, '/account?payment=cancelled');
  }

  let config;
  try {
    config = ccavenueConfig();
  } catch {
    console.error('[ccavenue] callback reached with no gateway configuration');
    return back(origin, '/account?payment=unavailable');
  }

  // Decrypted only to learn the order number. Nothing else in here is acted on.
  let orderNumber = '';
  try {
    orderNumber = readRedirect(encResp, config.workingKey).orderNumber;
  } catch {
    console.error('[ccavenue] callback payload did not decrypt');
    return back(origin, '/account?payment=unreadable');
  }

  if (!orderNumber) {
    return back(origin, '/account?payment=unreadable');
  }

  const db = adminClient();

  const { data: order, error: lookupError } = await db
    .from('orders')
    .select('id, order_number, status, total_paise')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (lookupError || !order) {
    console.error('[ccavenue] no order for', orderNumber, lookupError?.message);
    return back(origin, '/account?payment=unknown');
  }

  // Already settled by an earlier copy of this callback. Nothing to do but
  // show them the order.
  if (order.status !== 'pending_payment') {
    return back(origin, `/order/${encodeURIComponent(order.order_number)}`);
  }

  // ---------------------------------------------------------------------
  // The authority. Everything above was a hint about which row to look at.
  // ---------------------------------------------------------------------
  let truth;
  try {
    truth = await fetchOrderStatus(config, orderNumber);
  } catch (cause) {
    // We do not know what happened. Cancelling here could throw away a real
    // payment, so the order is left exactly as it is for a person to settle,
    // and the customer is told the truth rather than a guess.
    console.error('[ccavenue] status check failed for', orderNumber, cause);
    return back(origin, `/order/${encodeURIComponent(order.order_number)}?payment=pending`);
  }

  // Read once into a definite number so the amount that is checked and the
  // amount that is recorded cannot be two different readings.
  const paidPaise = truth.amountPaise;
  const amountAgrees = paidPaise !== null && paidPaise === order.total_paise;

  if (truth.paid && amountAgrees) {
    const { error } = await db.rpc('confirm_online_payment', {
      p_order_id: order.id,
      p_provider: 'ccavenue',
      p_payment_id: truth.trackingId ?? orderNumber,
      p_amount: paidPaise as number,
      p_reference: truth.bankReference,
      p_method: truth.paymentMode,
      p_signature: null,
    });

    if (error) {
      console.error('[ccavenue] confirm refused for', orderNumber, error.message);
      return back(origin, `/order/${encodeURIComponent(order.order_number)}?payment=pending`);
    }
    return back(origin, `/order/${encodeURIComponent(order.order_number)}?payment=paid`);
  }

  if (truth.paid && !amountAgrees) {
    // Paid, but not the amount this order is for. Confirming it would accept
    // a price the shop never set. Left standing, loudly, for a person.
    console.error(
      '[ccavenue] amount mismatch on',
      orderNumber,
      'gateway',
      paidPaise,
      'order',
      order.total_paise,
    );
    return back(origin, `/order/${encodeURIComponent(order.order_number)}?payment=mismatch`);
  }

  // Declined, abandoned or cancelled: release the stock so the piece goes back
  // on the shelf instead of being held for an order nobody paid for.
  const { error } = await db.rpc('fail_online_payment', {
    p_order_id: order.id,
    p_reason: truth.message ?? truth.status,
  });
  if (error) {
    console.error('[ccavenue] could not release', orderNumber, error.message);
  }

  return back(origin, '/checkout?payment=failed');
}

/**
 * Some CCAvenue configurations return by GET. The transaction is looked up the
 * same way regardless, so this is a thin redirect into the same handling
 * rather than a second implementation that could drift.
 */
export async function GET(request: Request) {
  const origin =
    process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? new URL(request.url).origin;
  return back(origin, '/account?payment=cancelled');
}
