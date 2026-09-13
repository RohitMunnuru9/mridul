'use server';

import { revalidatePath } from 'next/cache';
import { sessionClient } from '@mridul/supabase/server';

export type DeliveryResult = { ok: boolean; message: string };

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

/**
 * Supabase hands back whatever went wrong verbatim, and "Gateway Timeout" is
 * not a thing to show somebody who has just typed out their address. Only the
 * rules written below are worth quoting; everything else becomes one sentence
 * that says what actually happened and what to do about it.
 */
function humanError(message: string | undefined): string {
  if (message && /timeout|timed out|fetch failed|network|50[234]/i.test(message)) {
    return 'That took too long to save. Nothing you typed has been lost — please try again.';
  }
  return 'Your details could not be saved just now. Please try again.';
}

function indianPhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (!/^[6-9][0-9]{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export async function saveDeliveryDetails(formData: FormData): Promise<DeliveryResult> {
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: 'Your session expired. Please sign in again.' };

  const fullName = text(formData, 'full_name');
  const phone = indianPhone(text(formData, 'phone'));
  const line1 = text(formData, 'line1');
  const line2 = text(formData, 'line2');
  const landmark = text(formData, 'landmark');
  const city = text(formData, 'city');
  const state = text(formData, 'state');
  const pincode = text(formData, 'pincode').replace(/\s/g, '');

  if (fullName.length < 2) return { ok: false, message: 'Enter the recipient’s full name.' };
  if (!phone) return { ok: false, message: 'Enter a valid 10-digit Indian mobile number.' };
  if (line1.length < 5) return { ok: false, message: 'Enter the house number and street address.' };
  if (!city || !state) return { ok: false, message: 'Enter the city and state.' };
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return { ok: false, message: 'Enter a valid 6-digit Indian pincode.' };

  // The profile write and the address lookup do not depend on each other, so
  // they go together. Every round trip here is a trip to the database and back
  // while somebody waits on a form.
  const [{ error: profileError }, { data: existing, error: lookupError }] =
    await Promise.all([
      db.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id),
      db
        .from('addresses')
        .select('id')
        .eq('customer_id', user.id)
        .eq('is_default', true)
        .maybeSingle(),
    ]);

  if (profileError) return { ok: false, message: humanError(profileError.message) };
  if (lookupError) return { ok: false, message: humanError(lookupError.message) };

  const address = {
    full_name: fullName,
    phone,
    line1,
    line2: line2 || null,
    landmark: landmark || null,
    city,
    state,
    pincode,
    country: 'IN' as const,
    is_default: true,
  };

  const result = existing
    ? await db.from('addresses').update(address).eq('id', existing.id)
    : await db.from('addresses').insert({ ...address, customer_id: user.id });
  if (result.error) return { ok: false, message: humanError(result.error.message) };

  revalidatePath('/checkout');
  revalidatePath('/account');
  return { ok: true, message: 'Delivery details saved. You are ready for payment.' };
}

/* ---------------------------------------------------------------------------
 * Placing the order
 *
 * The browser sends variant ids and quantities. That is all it sends, and all
 * it is allowed to send: `place_order` in the database reads every price from
 * `products`, re-validates the discount code against its own subtotal, reads
 * the shipping charge from `settings`, locks and decrements stock, and writes
 * the total itself. A tampered bag can ask for a different piece; it cannot
 * ask for a different price.
 *
 * The delivery address is not sent either — it is read back from the row the
 * customer saved above, under their own session, so an order cannot be
 * addressed to somebody else's saved address.
 * ------------------------------------------------------------------------- */

export type BagItem = { variantId: string; quantity: number };

export type PlaceOrderResult =
  | { ok: true; orderNumber: string }
  | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function placeOrder(
  items: BagItem[],
  couponCode = '',
  notes = '',
): Promise<PlaceOrderResult> {
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, message: 'Your session expired. Please sign in again.' };
  }

  // Shaped before it goes anywhere near the database: ids that are not uuids
  // and quantities that are not whole numbers are dropped here rather than
  // relied on to fail a cast later.
  const lines = (Array.isArray(items) ? items : [])
    .filter((item) => UUID.test(String(item?.variantId ?? '')))
    .map((item) => ({
      variant_id: String(item.variantId),
      quantity: Math.trunc(Number(item.quantity)),
    }))
    .filter((item) => item.quantity >= 1 && item.quantity <= 10);

  if (lines.length === 0) {
    return { ok: false, message: 'Your bag is empty.' };
  }

  const { data: address, error: addressError } = await db
    .from('addresses')
    .select('full_name, phone, line1, line2, landmark, city, state, pincode')
    .eq('customer_id', user.id)
    .eq('is_default', true)
    .maybeSingle();

  if (addressError) return { ok: false, message: humanError(addressError.message) };
  if (!address) {
    return {
      ok: false,
      message: 'Save your delivery details above before placing the order.',
    };
  }

  const { data, error } = await db.rpc('place_order', {
    p_items: lines,
    p_address: address,
    p_coupon: couponCode.trim() || null,
    p_notes: notes.trim() || null,
  });

  if (error) {
    // Everything `place_order` raises deliberately is already a sentence a
    // customer can act on ("Only 2 left of…"). Anything else is a fault on our
    // side and should not be shown as though they did something wrong.
    const ours = error.code === 'P0001';
    return {
      ok: false,
      message: ours
        ? error.message
        : 'The order could not be placed just now. Please try again, or message us on WhatsApp.',
    };
  }

  const placed = data as { order_number?: string } | null;
  if (!placed?.order_number) {
    return {
      ok: false,
      message: 'The order could not be placed just now. Please try again.',
    };
  }

  revalidatePath('/account');
  return { ok: true, orderNumber: placed.order_number };
}
