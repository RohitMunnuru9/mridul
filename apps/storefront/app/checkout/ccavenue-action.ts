'use server';

/**
 * Handing the customer over to CCAvenue.
 *
 * This action builds the encrypted request and nothing else. It does not mark
 * anything paid, and it cannot: the only function that confirms an order is
 * revoked from every role a browser session can reach.
 *
 * The amount is read from the order row here, under the customer's own
 * session, which means RLS has already decided they are allowed to see it. The
 * browser tells us *which* order to pay for and nothing more — and even that
 * is checked, because an id belonging to somebody else simply does not come
 * back from the select.
 */

import { sessionClient } from '@mridul/supabase/server';
import {
  buildPaymentRequest,
  ccavenueConfig,
  type BillingDetails,
} from '@mridul/payments/ccavenue';

export type PaymentHandoff =
  | {
      ok: true;
      /** CCAvenue's form endpoint. The browser POSTs to it directly. */
      action: string;
      encRequest: string;
      accessCode: string;
    }
  | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ShippingAddress = {
  full_name?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

/**
 * Where CCAvenue sends the customer back to.
 *
 * It has to be an absolute URL, and it has to be one CCAvenue has on file for
 * the account — so it comes from configuration rather than from the incoming
 * request, whose Host header is not ours to trust.
 */
function origin(): string {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN;
  if (!configured) {
    throw new Error('NEXT_PUBLIC_STOREFRONT_ORIGIN is not set.');
  }
  return configured.replace(/\/+$/, '');
}

export async function startCCAvenuePayment(orderId: string): Promise<PaymentHandoff> {
  if (!UUID.test(orderId)) {
    return { ok: false, message: 'That order could not be found.' };
  }

  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, message: 'Your session expired. Please sign in again.' };
  }

  const { data: order, error } = await db
    .from('orders')
    .select('id, order_number, status, payment_method, total_paise, email, phone, shipping_address')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: 'We could not reach the payment page just now.' };
  }
  // No row means either no such order or not theirs. Both are the same
  // sentence: telling them apart would answer a question about somebody
  // else's order.
  if (!order) {
    return { ok: false, message: 'That order could not be found.' };
  }
  if (order.payment_method !== 'ccavenue') {
    return { ok: false, message: 'That order is not being paid online.' };
  }
  if (order.status !== 'pending_payment') {
    return { ok: false, message: 'That order has already been dealt with.' };
  }
  if (!order.total_paise || order.total_paise <= 0) {
    return { ok: false, message: 'That order has nothing to pay.' };
  }

  const address = (order.shipping_address ?? {}) as ShippingAddress;

  const billing: BillingDetails = {
    name: address.full_name ?? '',
    email: order.email ?? user.email ?? '',
    // CCAvenue wants the ten digits on their own; the +91 we store is a
    // prefix their field rejects.
    phone: (address.phone ?? order.phone ?? '').replace(/^\+91/, ''),
    line1: address.line1 ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    pincode: address.pincode ?? '',
  };

  try {
    const config = ccavenueConfig();
    const request = buildPaymentRequest({
      config,
      orderNumber: order.order_number,
      amountPaise: order.total_paise,
      redirectUrl: `${origin()}/api/payment/ccavenue/callback`,
      cancelUrl: `${origin()}/api/payment/ccavenue/callback`,
      billing,
    });
    return { ok: true, ...request };
  } catch {
    // The reason is a configuration fault and belongs in the server log, not
    // in front of a customer holding a saree they want to buy.
    return {
      ok: false,
      message: 'Online payment is not available just now. Please try cash on delivery.',
    };
  }
}
